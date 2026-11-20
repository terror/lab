import type { ToolProgress, ToolResult } from '@/components/tools';
import {
  CompactionEntry,
  type EntryRecord,
  type InboxState,
  type LiveState,
  type TranscriptItem,
} from '@earendil-works/pi-durable';
import { attachmentSchema } from '@lab/server/schemas';
import { z } from 'zod';

import { imageSource } from './attachments';
import { client } from './client';
import type { Fork } from './conversations';
import type { ModelKey } from './models';

export type Part =
  | { type: 'text'; text: string }
  | { type: 'thinking'; thinking: string; redacted?: boolean }
  | {
      type: 'toolCall';
      id: string;
      name: string;
      arguments: Record<string, unknown>;
    };

export type Gap = Extract<TranscriptItem, { kind: 'gap' }>;

type Content = string | readonly { type: string; text?: string }[];

function contentText(content: Content | undefined) {
  if (content === undefined) {
    return '';
  }

  if (typeof content === 'string') {
    return content;
  }

  return content
    .map((part) => (part.type === 'text' ? (part.text ?? '') : ''))
    .join('');
}

export type BubbleFile = { name: string; uploadId?: string };

export type UserBubble = {
  files?: BubbleFile[];
  id: string;
  images?: string[];
  text: string;
};

const userKinds = new Set(['lab.message', 'pi.user']);

const imagePartSchema = z.object({
  data: z.string(),
  mimeType: z.string(),
  type: z.literal('image'),
});

const diagnosticsSchema = z.object({
  diagnostics: z.array(z.object({ code: z.string() })),
});

const messageDataSchema = z.object({
  files: z
    .array(
      z.object({
        name: z.string(),
        type: z.enum(['file', 'image']),
        uploadId: z.string().optional(),
      })
    )
    .optional(),
  text: z.string().optional(),
});

export type Versions = { chats: readonly number[]; index: number };

function imageParts(content: unknown) {
  if (!Array.isArray(content)) {
    return [];
  }

  return content.flatMap((part: unknown) => {
    const image = imagePartSchema.safeParse(part);

    return image.success ? [image.data] : [];
  });
}

function messageImages(content: unknown, entry: EntryRecord) {
  return imageParts(content).map((image, index) => {
    if (image.data) {
      return imageSource(image);
    }

    return client.conversations[':id'].entries[':entryId'].images[
      ':index'
    ].$url({
      param: {
        entryId: String(entry.id),
        id: String(entry.conversationId),
        index: String(index),
      },
    }).href;
  });
}

function resultStatus(isError: boolean, data: unknown): ToolResult['status'] {
  const aborted = diagnosticsSchema
    .safeParse(data)
    .data?.diagnostics.some(({ code }) => code === 'aborted');

  if (aborted) {
    return 'stopped';
  }

  return isError ? 'failed' : 'done';
}

export function toolResults(items: readonly TranscriptItem[]) {
  const issued = new Map<string, number>();
  const results = new Map<string, ToolResult>();

  for (const item of items) {
    const message = item.kind === 'entry' ? item.entry.model?.[0] : undefined;

    if (message?.role === 'assistant') {
      for (const part of message.content) {
        if (part.type === 'toolCall') {
          issued.set(part.id, message.timestamp + (message.durationMs ?? 0));
        }
      }
    }

    if (item.kind === 'entry' && message?.role === 'toolResult') {
      const start = issued.get(message.toolCallId);

      results.set(message.toolCallId, {
        details: message.details,
        output: contentText(message.content),
        span:
          start === undefined ? undefined : { end: message.timestamp, start },
        status: resultStatus(message.isError, item.entry.data),
      });
    }
  }

  return results;
}

export function toolProgress(tools: LiveState['tools'] | undefined) {
  return new Map<string, ToolProgress>(
    (tools ?? []).map(({ callId, details, output, status }) => [
      callId,
      { details, output, status },
    ])
  );
}

export type Row =
  | { key: string; kind: 'earlier' }
  | { gap: Gap; key: string; kind: 'gap' }
  | {
      entryId?: number;
      key: string;
      kind: 'assistant';
      model?: ModelKey;
      parts: readonly Part[];
      span?: Span;
      streaming?: boolean;
    }
  | { bubble: UserBubble; entryId: number; key: string; kind: 'user' }
  | { key: string; kind: 'compaction' };

export type Span = { end: number; start: number };

function joined(first: Span | undefined, second: Span | undefined) {
  if (!first || !second) {
    return first ?? second;
  }

  return {
    end: Math.max(first.end, second.end),
    start: Math.min(first.start, second.start),
  };
}

export function visible(parts: readonly Part[]) {
  return parts.some(
    (part) =>
      (part.type === 'text' && part.text.length > 0) || part.type === 'toolCall'
  );
}

function rowsFor(item: TranscriptItem): Row[] {
  if (item.kind === 'earlier') {
    return [{ key: 'earlier', kind: 'earlier' }];
  }

  if (item.kind === 'gap') {
    return [{ gap: item, key: `gap-${item.after}`, kind: 'gap' }];
  }

  const key = `entry-${item.entry.id}`;
  const message = item.entry.model?.[0];

  if (message?.role === 'assistant') {
    const span = {
      end: message.timestamp + (message.durationMs ?? 0),
      start: message.timestamp,
    };

    const model = { id: message.model, provider: message.provider };

    return visible(message.content)
      ? [
          {
            entryId: item.entry.id,
            key,
            kind: 'assistant',
            model,
            parts: message.content,
            span,
          },
        ]
      : [];
  }

  if (item.entry.kind === CompactionEntry.kind) {
    return [{ key, kind: 'compaction' }];
  }

  if (!userKinds.has(item.entry.kind)) {
    return [];
  }

  const bubble = messageBubble(
    key,
    item.entry.data,
    message?.content,
    messageImages(message?.content, item.entry)
  );

  if (!bubble.text && bubble.images.length === 0 && bubble.files.length === 0) {
    return [];
  }

  return [{ bubble, entryId: item.entry.id, key, kind: 'user' }];
}

function messageBubble(
  id: string,
  data: unknown,
  content: Parameters<typeof contentText>[0],
  images: string[]
) {
  const message = messageDataSchema.safeParse(data).data;

  const files = (message?.files ?? [])
    .filter(({ type }) => type === 'file')
    .map(({ name, uploadId }) => ({ name, uploadId }));

  return { files, id, images, text: message?.text ?? contentText(content) };
}

const draftFilesSchema = z.object({
  files: z.array(z.looseObject({ type: z.enum(['file', 'image']) })),
});

function draftAttachments(data: unknown, content: unknown) {
  const files = draftFilesSchema.safeParse(data).data?.files ?? [];

  const images = imageParts(content);

  const pictures = files.filter(({ type }) => type === 'image');

  return files.flatMap((file) => {
    const attachment = attachmentSchema.safeParse(
      file.type === 'image'
        ? { ...images[pictures.indexOf(file)], ...file }
        : file
    );

    return attachment.success ? [attachment.data] : [];
  });
}

export function queuedMessages(inbox: InboxState | undefined) {
  return (inbox?.items ?? []).flatMap((item) => {
    if (item.mode === 'write') {
      return [];
    }

    const bubble = messageBubble(
      `queued-${item.id}`,
      item.entry?.data,
      item.content,
      imageParts(item.content).map(imageSource)
    );

    return [
      {
        attachments: draftAttachments(item.entry?.data, item.content),
        bubble,
        submission: Number(item.id),
      },
    ];
  });
}

export function ownsPlan(row: Row, callId: string | null | undefined) {
  return (
    row.kind === 'assistant' &&
    row.parts.some((part) => part.type === 'toolCall' && part.id === callId)
  );
}

const rowCache = new WeakMap<object, Row[]>();

export function cachedRows(item: TranscriptItem) {
  const source = item.kind === 'entry' ? item.entry : item;

  const cached = rowCache.get(source);

  if (cached) {
    return cached;
  }

  const rows = rowsFor(item);

  rowCache.set(source, rows);

  return rows;
}

export function mergeReplies(rows: readonly Row[]) {
  const merged: Row[] = [];

  for (const row of rows) {
    const last = merged.at(-1);

    if (row.kind === 'assistant' && last?.kind === 'assistant') {
      merged[merged.length - 1] = {
        ...last,
        parts: [...last.parts, ...row.parts],
        span: joined(last.span, row.span),
      };
    } else {
      merged.push(row);
    }
  }

  return merged;
}

type KeyedRow = { key: string; row: Row };

export function keyRows(rows: readonly Row[]) {
  const keyed: KeyedRow[] = [];

  let count = 0;

  let user = 'start';

  for (const row of rows) {
    if (row.kind === 'user') {
      count = 0;
      user = row.key;
    } else if (row.kind === 'assistant') {
      count += 1;
    }

    keyed.push({
      key: row.kind === 'assistant' ? `reply-${user}-${count}` : row.key,
      row,
    });
  }

  return { next: `reply-${user}-${count + 1}`, rows: keyed };
}

export function streamRows(
  { next, rows }: ReturnType<typeof keyRows>,
  partial: readonly Part[]
) {
  if (!visible(partial)) {
    return rows;
  }

  const last = rows.at(-1);

  if (last?.row.kind === 'assistant') {
    const row: Row = {
      key: last.key,
      kind: 'assistant',
      parts: [...last.row.parts, ...partial],
      span: last.row.span,
      streaming: true,
    };

    return [...rows.slice(0, -1), { key: last.key, row }];
  }

  const row: Row = {
    key: next,
    kind: 'assistant',
    parts: partial,
    streaming: true,
  };

  return [...rows, { key: next, row }];
}

export function toolHistory(
  rows: readonly Row[],
  results: ReadonlyMap<string, ToolResult>
) {
  return rows
    .flatMap((row) => (row.kind === 'assistant' ? row.parts : []))
    .flatMap((part) =>
      part.type === 'toolCall'
        ? [
            {
              args: part.arguments,
              details: results.get(part.id)?.details,
              name: part.name,
            },
          ]
        : []
    );
}

export function versionRows(
  rows: readonly Row[],
  forks: readonly Fork[],
  current: number
) {
  const placed = new Map<Row, Versions>();

  for (const { after, chats } of forks) {
    const index = rows.findIndex(
      (row) =>
        (row.kind === 'assistant' || row.kind === 'user') &&
        row.entryId !== undefined &&
        row.entryId > (after ?? 0)
    );

    const row = rows[index];
    const previous = rows[index - 1];

    if (row && previous?.kind !== 'earlier' && previous?.kind !== 'gap') {
      placed.set(row, { chats, index: chats.indexOf(current) });
    }
  }

  return placed;
}
