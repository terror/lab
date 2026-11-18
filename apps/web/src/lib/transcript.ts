import type { ToolProgress, ToolResult } from '@/components/tools';
import {
  CompactionEntry,
  type EntryRecord,
  type LiveState,
  type TranscriptItem,
} from '@earendil-works/pi-durable';
import { z } from 'zod';

import { imageSource } from './attachments';
import { client } from './client';
import { contentText, type Fork, type Gap } from './conversations';
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

function messageImages(content: unknown, entry: EntryRecord) {
  if (!Array.isArray(content)) {
    return [];
  }

  const images = content.flatMap((part: unknown) => {
    const image = imagePartSchema.safeParse(part);

    return image.success ? [image.data] : [];
  });

  return images.map((image, index) => {
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

  const data = messageDataSchema.safeParse(item.entry.data).data;
  const text = data?.text ?? contentText(message?.content);
  const images = messageImages(message?.content, item.entry);

  const files = (data?.files ?? [])
    .filter(({ type }) => type === 'file')
    .map(({ name, uploadId }) => ({ name, uploadId }));

  if (!text && images.length === 0 && files.length === 0) {
    return [];
  }

  return [
    {
      bubble: { files, id: key, images, text },
      entryId: item.entry.id,
      key,
      kind: 'user',
    },
  ];
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

export function replyKeys(rows: readonly Row[]) {
  return rows.reduce<{ count: number; keys: string[]; user: string }>(
    (state, row) => {
      if (row.kind === 'user') {
        return { count: 0, keys: [...state.keys, row.key], user: row.key };
      }

      if (row.kind === 'assistant') {
        const count = state.count + 1;

        return {
          count,
          keys: [...state.keys, `reply-${state.user}-${count}`],
          user: state.user,
        };
      }

      return { ...state, keys: [...state.keys, row.key] };
    },
    { count: 0, keys: [], user: 'start' }
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
