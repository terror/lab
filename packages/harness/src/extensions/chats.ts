import {
  type ConversationId,
  type ToolExecutionResult,
  defineExtension,
  defineTool,
} from '@earendil-works/pi-durable';
import {
  bool,
  int,
  lit,
  obj,
  opt,
  str,
  union,
} from '@earendil-works/pi-schema';

import { requestApproval } from './host-input';
import { failure, once, text } from './results';

export type ChatSummary = { id: number; pinned: boolean; title: string | null };

export const trashKinds = ['conversation', 'project'] as const;

export type TrashKind = (typeof trashKinds)[number];

export type TrashEntry = {
  deletedAt: string;
  id: number;
  kind: TrashKind;
  title: string | null;
};

export type ChatsAccess = {
  pin(
    conversationId: ConversationId,
    chatId: number,
    pinned: boolean
  ): Promise<ChatSummary | undefined>;
  purge(
    conversationId: ConversationId,
    kind: TrashKind,
    id: number
  ): Promise<boolean>;
  rename(
    conversationId: ConversationId,
    chatId: number,
    title: string
  ): Promise<ChatSummary | undefined>;
  restore(
    conversationId: ConversationId,
    kind: TrashKind,
    id: number
  ): Promise<boolean>;
  trash(
    conversationId: ConversationId,
    chatId: number
  ): Promise<ChatSummary | undefined>;
  trashed(conversationId: ConversationId): Promise<TrashEntry[]>;
};

function name(title: string | null) {
  return title ?? 'Untitled chat';
}

const missingChat = 'No chat has that id.';

const chatId = int({
  description: 'The chat id. Defaults to this chat.',
  minimum: 1,
});

const kind = union(
  trashKinds.map((value) => lit(value)),
  {
    description: 'Whether the item is a chat or a project.',
  }
);

const trashId = int({ description: 'The id from trash_list.', minimum: 1 });

function chatResult(
  chat: ChatSummary | undefined,
  done: (chat: ChatSummary) => string
): ToolExecutionResult {
  return chat
    ? { details: { chat }, output: text(done(chat)) }
    : failure(missingChat);
}

export function chats(access: ChatsAccess) {
  const chatRename = defineTool({
    name: 'chat_rename',
    description: 'Rename a chat in the sidebar.',
    parameters: obj({
      chat_id: opt(chatId),
      title: str({
        description: 'The new title.',
        maxLength: 200,
        minLength: 1,
      }),
    }),
    execute: async (args, api): Promise<ToolExecutionResult> =>
      chatResult(
        await access.rename(
          api.conversationId,
          args.chat_id ?? api.conversationId,
          args.title
        ),
        (chat) => `Renamed chat ${chat.id} to "${name(chat.title)}".`
      ),
  });

  const chatPin = defineTool({
    name: 'chat_pin',
    description: 'Pin a chat to the top of the sidebar, or unpin it.',
    parameters: obj({
      chat_id: opt(chatId),
      pinned: bool({ description: 'True pins the chat, false unpins it.' }),
    }),
    execute: async (args, api): Promise<ToolExecutionResult> =>
      chatResult(
        await access.pin(
          api.conversationId,
          args.chat_id ?? api.conversationId,
          args.pinned
        ),
        (chat) =>
          `${chat.pinned ? 'Pinned' : 'Unpinned'} "${name(chat.title)}".`
      ),
  });

  const chatDelete = defineTool({
    name: 'chat_delete',
    description:
      'Move a chat to the Trash. The user can restore it from Settings → Trash or with trash_restore.',
    parameters: obj({
      chat_id: int({ description: 'The chat id.', minimum: 1 }),
    }),
    execute: async (args, api): Promise<ToolExecutionResult> =>
      chatResult(
        await access.trash(api.conversationId, args.chat_id),
        (chat) => `Moved "${name(chat.title)}" to the Trash.`
      ),
  });

  const trashList = defineTool({
    name: 'trash_list',
    description: 'List the chats and projects in the Trash.',
    parameters: obj({}),
    execute: async (_args, api): Promise<ToolExecutionResult> => {
      const items = await access.trashed(api.conversationId);

      return {
        details: { count: items.length, items },
        output: text(
          items.length > 0
            ? items
                .map(
                  (item) =>
                    `[${item.kind} ${item.id}] ${name(item.title)} (deleted ${item.deletedAt.slice(0, 10)})`
                )
                .join('\n')
            : 'The Trash is empty.'
        ),
      };
    },
  });

  const trashRestore = defineTool({
    name: 'trash_restore',
    description: 'Restore a chat or project from the Trash.',
    parameters: obj({ id: trashId, kind }),
    execute: async (args, api): Promise<ToolExecutionResult> => {
      const item = (await access.trashed(api.conversationId)).find(
        (entry) => entry.kind === args.kind && entry.id === args.id
      );

      return item &&
        (await access.restore(api.conversationId, args.kind, args.id))
        ? {
            details: { item },
            output: text(`Restored ${args.kind} ${args.id}.`),
          }
        : failure('Nothing in the Trash has that id.');
    },
  });

  const trashPurge = defineTool({
    name: 'trash_purge',
    description:
      'Permanently delete a chat or project from the Trash. This cannot be undone, so the user must approve it.',
    callers: ['model'],
    replay: 'safe',
    parameters: obj({ id: trashId, kind }),
    execute: async (args, api, context): Promise<ToolExecutionResult> => {
      const item = (await access.trashed(api.conversationId)).find(
        (entry) => entry.kind === args.kind && entry.id === args.id
      );

      if (!item) {
        return failure('Nothing in the Trash has that id.');
      }

      const { approval, approved } = await requestApproval(api, context, {
        action: `Delete “${name(item.title)}” forever`,
        summary: [
          args.kind === 'project'
            ? 'The project and every chat in it will be permanently deleted.'
            : 'The chat will be permanently deleted.',
        ],
      });

      if (!approved) {
        return {
          details: { approval, item },
          output: text('The user declined to delete it.'),
        };
      }

      const purged = await once(api, 'purged', context, () =>
        access.purge(api.conversationId, args.kind, args.id)
      );

      return purged
        ? {
            details: { approval, item },
            output: text(`Permanently deleted ${args.kind} ${args.id}.`),
          }
        : failure('Nothing in the Trash has that id.');
    },
  });

  return defineExtension({
    name: 'lab.chats',
    tools: [
      chatDelete,
      chatPin,
      chatRename,
      trashList,
      trashPurge,
      trashRestore,
    ],
  });
}
