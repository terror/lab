import type { EntryRecord } from '@earendil-works/pi-durable';
import { schema } from '@lab/db';
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

import { requireUser } from './auth';
import { db } from './db';
import { fileHeaders } from './file-headers';
import { messageData } from './message-entry';
import { backfill, entryChanges, observe } from './pipeline';
import { contains, owners } from './records';
import { decodeText } from './text';
import { validator } from './validator';

const table = schema.libraryItem;

const PREVIEW_LENGTH = 400;

type Item = Omit<typeof table.$inferInsert, 'id'>;

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

async function record(entries: readonly EntryRecord[]) {
  const owned = await owners(
    entries.map(({ conversationId }) => conversationId)
  );

  const uploads = await uploadOwners(
    entries.flatMap((entry) =>
      attachments(entry).flatMap(({ uploadId }) => uploadId ?? [])
    )
  );

  for (const entry of entries) {
    const ownerId = owned.get(entry.conversationId);

    const attachedRows = (ownerId ? items(entry, ownerId) : []).map((row) => ({
      ...row,
      uploadId:
        row.uploadId && uploads.get(row.uploadId) === row.ownerId
          ? row.uploadId
          : null,
    }));

    const rows: Item[] = [
      ...attachedRows,
      ...(ownerId ? await savedItems(entry, ownerId) : []),
    ];

    if (rows.length > 0) {
      await db.insert(table).values(rows).onConflictDoNothing();
    }
  }
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
  mimeType: z.string(),
  name: z.string(),
  uploadId: z.string(),
});

function savedFile(entry: EntryRecord) {
  const message = entry.model?.[0];

  if (
    message?.role !== 'toolResult' ||
    message.toolName !== 'sandbox_save' ||
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

export const flushLibrary = observe(
  (changes) => entryChanges(changes, attached),
  record
);

export async function backfillLibrary() {
  const conversations = await db
    .select({ id: schema.conversation.id })
    .from(schema.conversation);

  for (const { id } of conversations) {
    await backfill('library', id, (page) => record(page.filter(attached)));
  }
}

async function uploadFor(id: number, ownerId: string) {
  const [row] = await db
    .select({
      content: schema.upload.content,
      mimeType: schema.upload.mimeType,
      thumbnail: schema.upload.thumbnail,
    })
    .from(table)
    .innerJoin(schema.upload, eq(schema.upload.id, table.uploadId))
    .where(and(eq(table.id, id), eq(table.ownerId, ownerId)));

  return row;
}

const listing = validator(
  'query',
  z.object({
    cursor: z
      .string()
      .regex(/^\d+\.\d+\.\d+$/)
      .optional(),
    kind: z.enum(['file', 'image']).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(60),
    search: z.string().trim().min(1).max(200).optional(),
  })
);

const params = validator(
  'param',
  z.object({ id: z.coerce.number().int().positive() })
);

const download = validator(
  'query',
  z.object({ download: z.literal('1').optional() })
);

function after(cursor: string) {
  const [time = 0, entryId = 0, position = 0] = cursor.split('.').map(Number);

  const createdAt = new Date(time).toISOString();

  return sql`(${table.createdAt}, ${table.entryId}, -${table.position}) < (${createdAt}::timestamp, ${entryId}, ${-position})`;
}

function cursorFor(row: {
  createdAt: Date;
  entryId: number;
  position: number;
}) {
  return `${row.createdAt.getTime()}.${row.entryId}.${row.position}`;
}

const library = new Hono()
  .use(requireUser)
  .get('/', listing, async (c) => {
    const user = c.get('user');

    const { cursor, kind, limit, search } = c.req.valid('query');

    await flushLibrary();

    const rows = await db
      .select({
        conversation: {
          id: table.conversationId,
          title: schema.conversation.title,
        },
        createdAt: table.createdAt,
        entryId: table.entryId,
        id: table.id,
        kind: table.kind,
        mimeType: table.mimeType,
        name: table.name,
        position: table.position,
        preview: table.preview,
        size: sql<number>`coalesce(octet_length(${schema.upload.content}), ${table.size})::int`,
        thumbnail: sql<boolean>`${schema.upload.thumbnail} is not null`,
        uploadId: table.uploadId,
      })
      .from(table)
      .innerJoin(
        schema.conversation,
        eq(schema.conversation.id, table.conversationId)
      )
      .leftJoin(schema.upload, eq(schema.upload.id, table.uploadId))
      .where(
        and(
          eq(table.ownerId, user.id),
          isNull(schema.conversation.deletedAt),
          kind === undefined ? undefined : eq(table.kind, kind),
          search === undefined ? undefined : contains(table.name, search),
          cursor === undefined ? undefined : after(cursor)
        )
      )
      .orderBy(desc(table.createdAt), desc(table.entryId), asc(table.position))
      .limit(limit + 1);

    const page = rows.slice(0, limit);

    const last = page.at(-1);

    return c.json({
      items: page.map((row) => ({
        conversation: row.conversation,
        createdAt: row.createdAt.toISOString(),
        id: row.id,
        kind: row.kind,
        mimeType: row.mimeType,
        name: row.name,
        preview: row.preview,
        size: row.size,
        upload: row.uploadId
          ? { id: row.uploadId, thumbnail: row.thumbnail }
          : null,
      })),
      next: last && rows.length > limit ? cursorFor(last) : null,
    });
  })
  .get('/:id/original', params, async (c) => {
    const upload = await uploadFor(c.req.valid('param').id, c.get('user').id);

    if (!upload) {
      throw new HTTPException(404, { message: 'File not found' });
    }

    return c.body(
      new Uint8Array(upload.content),
      200,
      fileHeaders(upload.mimeType)
    );
  })
  .get('/:id/thumbnail', params, async (c) => {
    const upload = await uploadFor(c.req.valid('param').id, c.get('user').id);

    if (!upload?.thumbnail) {
      throw new HTTPException(404, { message: 'Thumbnail not found' });
    }

    return c.body(
      new Uint8Array(upload.thumbnail),
      200,
      fileHeaders('image/png')
    );
  })
  .get('/:id', params, download, async (c) => {
    const user = c.get('user');

    const { id } = c.req.valid('param');

    const [item] = await db
      .select({
        content: table.content,
        kind: table.kind,
        mimeType: table.mimeType,
        name: table.name,
      })
      .from(table)
      .where(and(eq(table.id, id), eq(table.ownerId, user.id)));

    if (!item) {
      throw new HTTPException(404, { message: 'File not found' });
    }

    const { download: downloading } = c.req.valid('query');

    const original = downloading ? await uploadFor(id, user.id) : undefined;

    const disposition = downloading ? 'attachment' : 'inline';

    const type =
      original?.mimeType ??
      (item.kind === 'file' ? 'text/plain; charset=utf-8' : item.mimeType);

    const filename =
      !original && /\.pdf$/i.test(item.name) ? `${item.name}.txt` : item.name;

    return c.body(new Uint8Array(original?.content ?? item.content), 200, {
      ...fileHeaders(type),
      'content-disposition': `${disposition}; filename*=UTF-8''${encodeURIComponent(filename)}`,
    });
  });

export default library;
