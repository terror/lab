import { schema } from '@lab/db';
import {
  type Connector,
  type ConnectorTool,
  connectorsExtension,
} from '@lab/harness';
import { UnauthorizedError } from '@modelcontextprotocol/sdk/client/auth.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { eq } from 'drizzle-orm';

import { connectorAuth } from './connector-auth';
import { db } from './db';
import { policy } from './policy';
import { registry } from './registry';

type Row = typeof schema.connector.$inferSelect;

export type ConnectorState =
  | {
      kind: 'connected';
      tools: { description: string; name: string; readOnly: boolean }[];
    }
  | { kind: 'connecting' }
  | { kind: 'error'; message: string }
  | { kind: 'off' }
  | { kind: 'unauthorized' };

type Entry = { ownerId: string } & (
  | { client: Client; connector: Connector; kind: 'connected' }
  | { kind: 'error'; message: string }
  | { kind: 'off' }
  | { kind: 'unauthorized' }
);

const TIMEOUT = 15_000;

const TOOL_PAGES = 20;

const entries = new Map<number, Entry>();

const queues = new Map<number, Promise<void>>();

async function locked(id: number, task: () => Promise<void>) {
  const next = (queues.get(id) ?? Promise.resolve()).then(task);

  const settled = next.catch(() => undefined);

  queues.set(id, settled);

  try {
    await next;
  } finally {
    if (queues.get(id) === settled) {
      queues.delete(id);
    }
  }
}

export function connectorSlug(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 24) || 'connector'
  );
}

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function resultText({ content, structuredContent }: CallToolResult) {
  const parts = content.map((part) => {
    switch (part.type) {
      case 'text':
        return part.text;
      case 'resource':
        return 'text' in part.resource ? part.resource.text : part.resource.uri;
      case 'resource_link':
        return `${part.name}: ${part.uri}`;
      default:
        return `[${part.type} content]`;
    }
  });

  if (parts.length === 0 && structuredContent !== undefined) {
    return JSON.stringify(structuredContent);
  }

  return parts.join('\n\n');
}

async function listTools(
  client: Client,
  cursor?: string,
  page = 1
): Promise<ConnectorTool[]> {
  if (page > TOOL_PAGES) {
    throw new Error('The server lists too many tools');
  }

  const { nextCursor, tools } = await client.listTools(
    { cursor },
    { timeout: TIMEOUT }
  );

  const listed = tools.map((tool): ConnectorTool => ({
    description: tool.description ?? tool.title ?? tool.name,
    name: tool.name,
    parameters: tool.inputSchema,
    readOnly: tool.annotations?.readOnlyHint === true,
    title: tool.title ?? tool.annotations?.title ?? tool.name,
  }));

  return nextCursor === undefined
    ? listed
    : [...listed, ...(await listTools(client, nextCursor, page + 1))];
}

export function connectorsExtensionName(ownerId: string) {
  return `connectors-${ownerId}`;
}

function syncOwner(ownerId: string) {
  const connected = [...entries.values()].flatMap((entry) =>
    entry.ownerId === ownerId && entry.kind === 'connected'
      ? [entry.connector]
      : []
  );

  const name = connectorsExtensionName(ownerId);

  if (connected.length > 0) {
    registry.install(connectorsExtension(name, connected));
  } else {
    registry.uninstall({ name });
  }
}

async function disconnect(id: number) {
  const entry = entries.get(id);

  entries.delete(id);

  if (entry?.kind === 'connected') {
    await entry.client.close().catch(() => undefined);
  }

  return entry?.ownerId;
}

async function connect({
  id,
  name,
  ownerId,
  trustReadOnly,
  url,
}: Row): Promise<Entry> {
  const client = new Client({ name: 'Lab', version: '1.0.0' });

  try {
    const transport = new StreamableHTTPClientTransport(new URL(url), {
      authProvider: connectorAuth(id),
      fetch: (await policy(ownerId)).fetch,
    });

    await client.connect(transport, { timeout: TIMEOUT });

    const tools = await listTools(client);

    return {
      client,
      connector: {
        call: async (
          tool: string,
          args: Record<string, unknown>,
          signal: AbortSignal | undefined
        ) => {
          const result = (await client.callTool(
            { arguments: args, name: tool },
            undefined,
            { signal }
          )) as CallToolResult;

          return {
            isError: result.isError === true,
            text: resultText(result),
          };
        },
        name,
        slug: connectorSlug(name),
        tools,
        trustReadOnly,
      },
      kind: 'connected',
      ownerId,
    };
  } catch (error) {
    await client.close().catch(() => undefined);

    if (error instanceof UnauthorizedError) {
      return { kind: 'unauthorized', ownerId };
    }

    return { kind: 'error', message: message(error), ownerId };
  }
}

export function refreshConnector({ id, ownerId }: Pick<Row, 'id' | 'ownerId'>) {
  return locked(id, async () => {
    await disconnect(id);

    const [row] = await db
      .select()
      .from(schema.connector)
      .where(eq(schema.connector.id, id));

    if (row) {
      const active = row.enabled && (await policy(ownerId)).active;

      entries.set(id, active ? await connect(row) : { kind: 'off', ownerId });
    }

    syncOwner(ownerId);
  });
}

export function removeConnector(id: number) {
  return locked(id, async () => {
    const ownerId = await disconnect(id);

    if (ownerId) {
      syncOwner(ownerId);
    }
  });
}

export function connectorState(id: number): ConnectorState {
  const entry = entries.get(id);

  if (entry === undefined) {
    return { kind: 'connecting' };
  }

  if (entry.kind === 'connected') {
    return {
      kind: 'connected',
      tools: entry.connector.tools.map(({ description, name, readOnly }) => ({
        description,
        name,
        readOnly,
      })),
    };
  }

  if (entry.kind === 'error') {
    return { kind: 'error', message: entry.message };
  }

  return { kind: entry.kind };
}

export async function startConnectors() {
  const rows = await db.select().from(schema.connector);

  await Promise.all(rows.map(refreshConnector));
}
