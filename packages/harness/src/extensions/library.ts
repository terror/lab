import {
  type ConversationId,
  type ToolExecutionResult,
  defineExtension,
  defineTool,
} from '@earendil-works/pi-durable';
import { int, obj, oneOf, opt, str } from '@earendil-works/pi-schema';

import { failure, listing, page, text } from './results';

export const READ_LENGTH = 100_000;

export type LibraryEntry = {
  chat: string | null;
  createdAt: string;
  id: number;
  kind: 'file' | 'image';
  name: string;
  size: number;
};

export type LibraryContent =
  | { kind: 'file'; name: string; text: string }
  | { data: string; kind: 'image'; mimeType: string; name: string };

export type LibraryAccess = {
  read(
    conversationId: ConversationId,
    id: number
  ): Promise<LibraryContent | undefined>;
  search(
    conversationId: ConversationId,
    query: { kind?: 'file' | 'image'; search?: string }
  ): Promise<LibraryEntry[]>;
};

function line({ chat, createdAt, id, kind, name, size }: LibraryEntry) {
  return `[${id}] ${name} (${kind}, ${size} bytes, ${createdAt.slice(0, 10)}${chat ? `, from "${chat}"` : ''})`;
}

export function library(access: LibraryAccess) {
  const search = defineTool({
    name: 'library_search',
    description:
      'Search the images and files the user has attached in any chat. Returns ids to pass to library_read.',
    parameters: obj({
      kind: opt(oneOf(['file', 'image'])),
      query: opt(
        str({ description: 'Words to match in file names.', maxLength: 200 })
      ),
    }),
    execute: async ({ kind, query }, api) =>
      listing(
        await access.search(api.conversationId, {
          kind,
          search: query?.trim() || undefined,
        }),
        { empty: 'No matching files.', key: 'entries', line }
      ),
  });

  const read = defineTool({
    name: 'library_read',
    description: `Read a file or image from the user's library by id. Text is returned ${READ_LENGTH} characters at a time; pass offset to read further into long files such as PDFs.`,
    parameters: obj({
      id: int({ minimum: 1 }),
      length: opt(int({ maximum: READ_LENGTH, minimum: 1 })),
      offset: opt(int({ minimum: 0 })),
    }),
    execute: async (
      { id, length, offset },
      api
    ): Promise<ToolExecutionResult> => {
      const content = await access.read(api.conversationId, id);

      if (!content) {
        return failure(`No library item has the id ${id}.`);
      }

      if (content.kind === 'image') {
        return {
          details: { id, name: content.name },
          output: [
            ...text(content.name),
            {
              data: content.data,
              mimeType: content.mimeType,
              type: 'image' as const,
            },
          ],
        };
      }

      const shown = page(content.text, offset ?? 0, length ?? READ_LENGTH, {
        ending: 'file',
        next: (end) => `Call library_read with offset ${end} to continue.`,
      });

      return {
        details: {
          end: shown.end,
          id,
          name: content.name,
          passage: shown.passage,
          start: shown.start,
          total: shown.total,
        },
        output: text(`${content.name}\n\n${shown.text}`),
      };
    },
  });

  return defineExtension({ name: 'lab.library', tools: [search, read] });
}
