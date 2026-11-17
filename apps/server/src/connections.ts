import { schema } from '@lab/db';
import {
  type ConnectorResult,
  type ConnectorTool,
  connector,
  createToolSearchExtension,
} from '@lab/harness';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import { db } from './db';
import { registry } from './harness';

type Row = typeof schema.connector.$inferSelect;

export type ConnectorState =
  | { kind: 'connected'; tools: { description: string; name: string }[] }
  | { kind: 'connecting' }
  | { kind: 'error'; message: string }
  | { kind: 'off' };

type Entry = { client?: Client; extension?: string; state: ConnectorState };

const TIMEOUT = 15_000;

const entries = new Map<number, Entry>();

const toolSearch = createToolSearchExtension();

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

function syncToolSearch() {
  const connected = [...entries.values()].some(
    ({ extension }) => extension !== undefined
  );

  if (connected) {
    registry.install(toolSearch);
  } else {
    registry.uninstall(toolSearch);
  }
}

async function disconnect(id: number) {
  const entry = entries.get(id);

  entries.delete(id);

  if (entry?.extension) {
    registry.uninstall({ name: entry.extension });
  }

  await entry?.client?.close().catch(() => undefined);
}

async function connect({ name, url }: Row): Promise<Entry> {
  const client = new Client({ name: 'Lab', version: '1.0.0' });

  try {
    await client.connect(new StreamableHTTPClientTransport(new URL(url)), {
      timeout: TIMEOUT,
    });

    const tools = await listTools(client);

    const extension = connector({
      call: async (tool, args): Promise<ConnectorResult> => {
        const result = (await client.callTool({
          arguments: args,
          name: tool,
        })) as CallToolResult;

        return { isError: result.isError === true, text: resultText(result) };
      },
      name,
      slug: connectorSlug(name),
      tools,
    });

    registry.install(extension);

    return {
      client,
      extension: extension.name,
      state: {
        kind: 'connected',
        tools: tools.map(({ description, name: tool }) => ({
          description,
          name: tool,
        })),
      },
    };
  } catch (error) {
    await client.close().catch(() => undefined);

    return { state: { kind: 'error', message: message(error) } };
  }
}

export function refreshConnector(row: Row) {
  return locked(async () => {
    await disconnect(row.id);

    entries.set(
      row.id,
      row.enabled ? await connect(row) : { state: { kind: 'off' } }
    );

    syncToolSearch();
  });
}

export function removeConnector(id: number) {
  return locked(async () => {
    await disconnect(id);

    syncToolSearch();
  });
}

export function connectorState(id: number): ConnectorState {
  return entries.get(id)?.state ?? { kind: 'connecting' };
}

export async function startConnectors() {
  const rows = await db.select().from(schema.connector);

  await Promise.all(rows.map(refreshConnector));
}
