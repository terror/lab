import type { Context } from '@earendil-works/chord/context';
import {
  type ConversationId,
  type ToolExecutionApi,
  type ToolExecutionResult,
  defineExtension,
  defineTool,
} from '@earendil-works/pi-durable';
import { int, obj, opt, str } from '@earendil-works/pi-schema';

import { MemoryDoc } from './memory';

export const HISTORY_READ_LENGTH = 20_000;

export type ChatMatch = {
  id: number;
  snippet: string;
  title: string | null;
  updatedAt: string;
};

export type ChatTranscript = { text: string; title: string | null };

export type HistoryAccess = {
  read(
    conversationId: ConversationId,
    id: number
  ): Promise<ChatTranscript | undefined>;
  search(conversationId: ConversationId, query: string): Promise<ChatMatch[]>;
};

const DISABLED =
  'Referencing other chats is turned off. The user can turn it on in Settings → Memory.';

function text(value: string) {
  return [{ text: value, type: 'text' as const }];
}

async function enabled(api: ToolExecutionApi, context: Context) {
  return (await api.snapshot(MemoryDoc, context))?.referenceChats === true;
}

function name(title: string | null) {
  return title ?? 'Untitled chat';
}

export function history(access: HistoryAccess) {
  const search = defineTool({
    name: 'chat_search',
    description:
      "Search the user's other chats for earlier discussions. Returns chat ids to pass to chat_read. Only works when the user has turned on referencing other chats.",
    parameters: obj({
      query: str({
        description: 'Words or a phrase to look for.',
        maxLength: 200,
        minLength: 1,
      }),
    }),
    execute: async ({ query }, api, context): Promise<ToolExecutionResult> => {
      if (!(await enabled(api, context))) {
        return { isError: true, output: text(DISABLED) };
      }

      const matches = await access.search(api.conversationId, query);

      const listing =
        matches.length === 0
          ? 'No matching chats.'
          : matches
              .map(
                ({ id, snippet, title, updatedAt }) =>
                  `[${id}] ${name(title)} (${updatedAt.slice(0, 10)}): ${snippet}`
              )
              .join('\n');

      return {
        details: { count: matches.length, matches },
        output: text(listing),
      };
    },
  });

  const read = defineTool({
    name: 'chat_read',
    description: `Read one of the user's other chats by id, ${HISTORY_READ_LENGTH} characters at a time; pass offset to continue. Only works when the user has turned on referencing other chats.`,
    parameters: obj({
      id: int({ minimum: 1 }),
      offset: opt(int({ minimum: 0 })),
    }),
    execute: async (
      { id, offset },
      api,
      context
    ): Promise<ToolExecutionResult> => {
      if (!(await enabled(api, context))) {
        return { isError: true, output: text(DISABLED) };
      }

      const transcript = await access.read(api.conversationId, id);

      if (!transcript) {
        return { isError: true, output: text(`No chat has the id ${id}.`) };
      }

      const start = Math.min(offset ?? 0, transcript.text.length);

      const end = Math.min(transcript.text.length, start + HISTORY_READ_LENGTH);

      const more =
        end < transcript.text.length
          ? `\n\n[Showing characters ${start}–${end} of ${transcript.text.length}. Call chat_read with offset ${end} to continue.]`
          : '';

      return {
        details: {
          end,
          id,
          passage: transcript.text.slice(start, end),
          start,
          title: transcript.title,
          total: transcript.text.length,
        },
        output: text(
          `${name(transcript.title)}\n\n${transcript.text.slice(start, end)}${more}`
        ),
      };
    },
  });

  return defineExtension({ name: 'lab.history', tools: [search, read] });
}
