import type { EntryRecord } from '@earendil-works/pi-durable';
import { schema } from '@lab/db';
import { type InferInsertModel, and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import { db } from './db';
import { messageData } from './message-entry';
import { entryPipeline } from './pipeline';
import { decodeText } from './text';

const table = schema.libraryItem;

const PREVIEW_LENGTH = 400;

type Item = InferInsertModel<
  typeof table,
  { dbColumnNames: false; override: true }
>;

function attachments(entry: EntryRecord) {
  return messageData(entry)?.files ?? [];
}

function items(entry: EntryRecord, ownerId: string): Item[] {
  const message = entry.model?.[0];

  if (message?.role !== 'user') {
    return [];
  }

  const images =
    typeof message.content === 'string'
      ? []
      : message.content.flatMap((part) =>
          part.type === 'image' ? [part] : []
        );

  const files = attachments(entry).map((file, position) => ({
    ...file,
    position,
  }));

  const base = {
    conversationId: entry.conversationId,
    createdAt: new Date(message.timestamp),
    entryId: entry.id,
    ownerId,
  };

  const imageItems = files
    .filter(({ type }) => type === 'image')
    .flatMap(({ name, position }, index) => {
      const image = images[index];

      if (!image) {
        return [];
      }

      const content = Uint8Array.fromBase64(image.data);

      return [
        {
          ...base,
          content,
          kind: 'image' as const,
          mimeType: image.mimeType,
          name,
          position,
          size: content.byteLength,
        },
      ];
    });

  const fileItems = files.flatMap(
    ({ name, position, text, type, uploadId }) => {
      if (type !== 'file' || text === undefined) {
        return [];
      }

      const content = new TextEncoder().encode(text);

      return [
        {
          ...base,
          content,
          kind: 'file' as const,
          mimeType: 'text/plain',
          name,
          position,
          preview: text.slice(0, PREVIEW_LENGTH),
          size: content.byteLength,
          uploadId,
        },
      ];
    }
  );

  return [...imageItems, ...fileItems];
}

async function libraryRows(
  entries: readonly EntryRecord[],
  owned: ReadonlyMap<number, string>
) {
  const uploads = await uploadOwners(
    entries.flatMap((entry) =>
      attachments(entry).flatMap(({ uploadId }) => uploadId ?? [])
    )
  );

  const rows = await Promise.all(
    entries.map(async (entry): Promise<Item[]> => {
      const ownerId = owned.get(entry.conversationId);

      if (!ownerId) {
        return [];
      }

      return [
        ...items(entry, ownerId).map((row) => ({
          ...row,
          uploadId:
            row.uploadId && uploads.get(row.uploadId) === row.ownerId
              ? row.uploadId
              : null,
        })),
        ...(await savedItems(entry, ownerId)),
      ];
    })
  );

  return rows.flat();
}

async function uploadOwners(ids: readonly string[]) {
  if (ids.length === 0) {
    return new Map<string, string>();
  }

  const rows = await db
    .select({ id: schema.upload.id, ownerId: schema.upload.ownerId })
    .from(schema.upload)
    .where(inArray(schema.upload.id, [...new Set(ids)]));

  return new Map(rows.map(({ id, ownerId }) => [id, ownerId]));
}

const savedSchema = z.object({
  libraryId: z.number().int().positive().optional(),
  mimeType: z.string(),
  name: z.string(),
  uploadId: z.string(),
});

const savingTools = new Set(['image_generate', 'sandbox_save']);

function savedFile(entry: EntryRecord) {
  const message = entry.model?.[0];

  if (
    message?.role !== 'toolResult' ||
    !savingTools.has(message.toolName) ||
    message.isError
  ) {
    return undefined;
  }

  return savedSchema.safeParse(message.details).data;
}

const imageTypes = new Set([
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

async function savedItems(
  entry: EntryRecord,
  ownerId: string
): Promise<Item[]> {
  const saved = savedFile(entry);

  if (!saved) {
    return [];
  }

  const [upload] = await db
    .select({ content: schema.upload.content })
    .from(schema.upload)
    .where(
      and(
        eq(schema.upload.id, saved.uploadId),
        eq(schema.upload.ownerId, ownerId)
      )
    );

  if (!upload) {
    return [];
  }

  const base = {
    conversationId: entry.conversationId,
    createdAt: new Date(entry.model?.[0]?.timestamp ?? Date.now()),
    entryId: entry.id,
    id: saved.libraryId,
    name: saved.name,
    ownerId,
    position: 0,
    uploadId: saved.uploadId,
  };

  if (imageTypes.has(saved.mimeType)) {
    return [
      {
        ...base,
        content: upload.content,
        kind: 'image',
        mimeType: saved.mimeType,
        size: upload.content.byteLength,
      },
    ];
  }

  const text = decodeText(upload.content) ?? '';

  return [
    {
      ...base,
      content: new TextEncoder().encode(text),
      kind: 'file',
      mimeType: 'text/plain',
      preview: text.slice(0, PREVIEW_LENGTH) || null,
      size: upload.content.byteLength,
    },
  ];
}

function attached(entry: EntryRecord) {
  return attachments(entry).length > 0 || savedFile(entry) !== undefined;
}

export const libraryPipeline = entryPipeline({
  keep: attached,
  name: 'library',
  rows: libraryRows,
  store: (rows) =>
    db.insert(table).overridingSystemValue().values(rows).onConflictDoNothing(),
});

export const flushLibrary = libraryPipeline.flush;
