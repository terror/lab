import type { ConversationId } from '@earendil-works/pi-durable';
import {
  type ToolExecutionResult,
  defineExtension,
  defineTool,
} from '@earendil-works/pi-durable';
import { bool, int, obj, opt, str } from '@earendil-works/pi-schema';

import { requestApproval } from './host-input';
import { errorMessage, failure, listing, once, text } from './results';

type ConnectorStatus =
  | 'connected'
  | 'connecting'
  | 'error'
  | 'off'
  | 'unauthorized';

export type ConnectorSummary = {
  enabled: boolean;
  error: string | null;
  host: string;
  id: number;
  name: string;
  status: ConnectorStatus;
  tools: number;
};

export type ConnectorChange = { enabled?: boolean; name?: string };

export type ConnectorAccess = {
  add(
    conversationId: ConversationId,
    fields: { name: string; url: string }
  ): Promise<ConnectorSummary>;
  list(conversationId: ConversationId): Promise<ConnectorSummary[]>;
  remove(conversationId: ConversationId, id: number): Promise<ConnectorSummary>;
  update(
    conversationId: ConversationId,
    id: number,
    change: ConnectorChange
  ): Promise<ConnectorSummary>;
};

const states: Record<ConnectorStatus, (connector: ConnectorSummary) => string> =
  {
    connected: ({ tools }) => `connected, ${tools} tools`,
    connecting: () => 'connecting',
    error: ({ error }) => `failed to connect: ${error ?? 'unknown error'}`,
    off: () => 'turned off',
    unauthorized: () => 'needs the user to sign in from Settings → Connectors',
  };

function line(connector: ConnectorSummary) {
  return `- [${connector.id}] ${connector.name} (${connector.host}): ${states[connector.status](connector)}`;
}

const id = int({ description: 'The id of the connector.', minimum: 1 });

const name = str({
  description: 'A short name for the connector.',
  maxLength: 64,
  minLength: 1,
});

async function attempt(
  run: () => Promise<ConnectorSummary>,
  done: (connector: ConnectorSummary) => string,
  details: object = {}
): Promise<ToolExecutionResult> {
  try {
    const connector = await run();

    return {
      details: { ...details, connector },
      output: text(`${done(connector)}\n${line(connector)}`),
    };
  } catch (error) {
    return failure(errorMessage(error));
  }
}

export function connectorSettings(access: ConnectorAccess) {
  const connectorList = defineTool({
    name: 'connector_list',
    description:
      "List the user's connectors: remote MCP servers whose tools you can find with tool_search.",
    parameters: obj({}),
    execute: async (_, api) =>
      listing(await access.list(api.conversationId), {
        empty: 'The user has no connectors.',
        key: 'connectors',
        line,
      }),
  });

  const connectorAdd = defineTool({
    name: 'connector_add',
    callers: ['model'],
    description:
      'Add a connector: a remote MCP server, by its URL, whose tools you can then find with tool_search. The user approves it first.',
    parameters: obj({
      name,
      url: str({ description: 'The MCP server URL.', minLength: 1 }),
    }),
    execute: async (args, api, context) => {
      const { approval, approved } = await requestApproval(api, context, {
        action: `Add the “${args.name}” connector`,
        summary: [args.url, 'Lab will be able to use its tools in your chats.'],
      });

      if (!approved) {
        return {
          details: { approval },
          output: text('The user declined to add it.'),
        };
      }

      return attempt(
        () =>
          once(api, 'added', context, () =>
            access.add(api.conversationId, args)
          ),
        () => 'Added the connector.',
        { approval }
      );
    },
  });

  const connectorUpdate = defineTool({
    name: 'connector_update',
    callers: ['model'],
    description:
      'Rename a connector or turn it on or off. Only the fields you pass change. The user approves turning one on.',
    parameters: obj({
      enabled: opt(bool({ description: 'Whether its tools are available.' })),
      id,
      name: opt(name),
    }),
    execute: async ({ id: connector, ...change }, api, context) => {
      if (change.enabled === undefined && change.name === undefined) {
        return failure('Pass a name or whether it is enabled.');
      }

      const update = () => access.update(api.conversationId, connector, change);

      if (change.enabled !== true) {
        return attempt(update, () => 'Updated the connector.');
      }

      const { approval, approved } = await requestApproval(api, context, {
        action: 'Turn on a connector',
        summary: ['Lab will be able to use its tools in your chats.'],
      });

      if (!approved) {
        return {
          details: { approval },
          output: text('The user declined to turn it on.'),
        };
      }

      return attempt(update, () => 'Updated the connector.', { approval });
    },
  });

  const connectorRemove = defineTool({
    name: 'connector_remove',
    callers: ['model'],
    description: 'Remove a connector. The user approves it first.',
    parameters: obj({ id }),
    execute: async (args, api, context) => {
      const { approval, approved } = await requestApproval(api, context, {
        action: 'Remove a connector',
        summary: ['Lab will no longer be able to use its tools.'],
      });

      if (!approved) {
        return {
          details: { approval },
          output: text('The user declined to remove it.'),
        };
      }

      return attempt(
        () =>
          once(api, 'removed', context, () =>
            access.remove(api.conversationId, args.id)
          ),
        () => 'Removed the connector.',
        { approval }
      );
    },
  });

  return defineExtension({
    name: 'lab.connectors',
    tools: [connectorAdd, connectorList, connectorRemove, connectorUpdate],
  });
}
