import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { AgentDoc } from '@earendil-works/pi-durable';
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

import { publicFetch } from './addresses';
import { isAdmin } from './auth';
import { connectorAuth } from './connector-auth';
import { db } from './db';
import { harness, registry } from './harness';

type Row = typeof schema.connector.$inferSelect;

export type ConnectorState =
  | { kind: 'connected'; tools: { description: string; name: string }[] }
  | { kind: 'connecting' }
  | { kind: 'error'; message: string }
  | { kind: 'off' }
  | { kind: 'unauthorized' };

type Entry = {
  client?: Client;
  connector?: Connector;
  ownerId: string;
  state: ConnectorState;
};

const TIMEOUT = 15_000;

const entries = new Map<number, Entry>();

let queue = Promise.resolve();

function locked<T>(task: () => Promise<T>) {
  const next = queue.then(task);

  queue = next.then(
    () => undefined,
    () => undefined
  );

  return next;
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
  cursor?: string
): Promise<ConnectorTool[]> {
  const { nextCursor, tools } = await client.listTools(
    { cursor },
    { timeout: TIMEOUT }
  );

  const page = tools.map((tool): ConnectorTool => ({
    description: tool.description ?? tool.title ?? tool.name,
    name: tool.name,
    parameters: tool.inputSchema,
    readOnly: tool.annotations?.readOnlyHint === true,
    title: tool.title ?? tool.annotations?.title ?? tool.name,
  }));

  return nextCursor === undefined
    ? page
    : [...page, ...(await listTools(client, nextCursor))];
}

export function connectorsExtensionName(ownerId: string) {
  return `connectors-${ownerId}`;
}

function syncOwner(ownerId: string) {
  const connected = [...entries.values()].flatMap((entry) =>
    entry.ownerId === ownerId && entry.connector ? [entry.connector] : []
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

  await entry?.client?.close().catch(() => undefined);

  return entry?.ownerId;
}

async function connect({ id, name, ownerId, url }: Row, local: boolean) {
  const client = new Client({ name: 'Lab', version: '1.0.0' });

  try {
    const transport = new StreamableHTTPClientTransport(new URL(url), {
      authProvider: connectorAuth(id),
      fetch: local ? fetch : publicFetch,
    });

    await client.connect(transport, { timeout: TIMEOUT });

    const tools = await listTools(client);

    return {
      client,
      connector: {
        call: async (tool: string, args: Record<string, unknown>) => {
          const result = (await client.callTool({
            arguments: args,
            name: tool,
          })) as CallToolResult;

          return {
            isError: result.isError === true,
            text: resultText(result),
          };
        },
        name,
        slug: connectorSlug(name),
        tools,
      },
      ownerId,
      state: {
        kind: 'connected' as const,
        tools: tools.map(({ description, name: tool }) => ({
          description,
          name: tool,
        })),
      },
    };
  } catch (error) {
    await client.close().catch(() => undefined);

    if (error instanceof UnauthorizedError) {
      return { ownerId, state: { kind: 'unauthorized' as const } };
    }

    return {
      ownerId,
      state: { kind: 'error' as const, message: message(error) },
    };
  }
}

export function refreshConnector(row: Row, local: boolean) {
  return locked(async () => {
    const previous = await disconnect(row.id);

    entries.set(
      row.id,
      row.enabled
        ? await connect(row, local)
        : { ownerId: row.ownerId, state: { kind: 'off' } }
    );

    if (previous && previous !== row.ownerId) {
      syncOwner(previous);
    }

    syncOwner(row.ownerId);
  });
}

export function removeConnector(id: number) {
  return locked(async () => {
    const ownerId = await disconnect(id);

    if (ownerId) {
      syncOwner(ownerId);
    }
  });
}

export function connectorState(id: number): ConnectorState {
  return entries.get(id)?.state ?? { kind: 'connecting' };
}

export async function startConnectors() {
  const rows = await db
    .select({ connector: schema.connector, email: schema.user.email })
    .from(schema.connector)
    .innerJoin(schema.user, eq(schema.user.id, schema.connector.ownerId));

  await Promise.all(
    rows.map(({ connector, email }) =>
      refreshConnector(connector, isAdmin({ email }))
    )
  );
}

type Conversation = NonNullable<
  Awaited<ReturnType<typeof harness.conversation>>
>;

export async function selectConnectors(
  conversation: Conversation,
  ownerId: string
) {
  const name = connectorsExtensionName(ownerId);

  const stored = (
    await harness.snapshot(AgentDoc, conversation.id, BACKGROUND_CONTEXT)
  )?.extensions;

  if (Array.isArray(stored) || stored?.add?.includes(name)) {
    return;
  }

  await conversation.configure(
    {
      extensions: {
        add: [...(stored?.add ?? []), name].map((added) => ({ name: added })),
        remove: (stored?.remove ?? []).map((removed) => ({ name: removed })),
      },
    },
    BACKGROUND_CONTEXT
  );
}
