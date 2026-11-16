import type { EntryRecord } from '@earendil-works/pi-durable';
import { schema } from '@lab/db';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

import { requireUser } from './auth';
import { db } from './db';
import { eachEntry, entryChanges, observe } from './pipeline';
import { contains, owners } from './records';
import { validator } from './validator';

const table = schema.libraryItem;

const PREVIEW_LENGTH = 400;

const dataSchema = z.object({
  files: z
    .array(
      z.object({
        name: z.string(),
        text: z.string().optional(),
        type: z.enum(['file', 'image']),
      })
    )
    .default([]),
});

type Item = Omit<typeof table.$inferInsert, 'id'>;

function attachments(entry: EntryRecord) {
  if (entry.kind !== 'lab.message') {
    return [];
  }

  return dataSchema.safeParse(entry.data).data?.files ?? [];
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

  const fileItems = files.flatMap(({ name, position, text, type }) => {
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
      },
    ];
  });

  return [...imageItems, ...fileItems];
}

async function record(entries: readonly EntryRecord[]) {
  const owned = await owners(
    entries.map(({ conversationId }) => conversationId)
  );

  for (const entry of entries) {
    const ownerId = owned.get(entry.conversationId);

    const rows = ownerId ? items(entry, ownerId) : [];

    if (rows.length > 0) {
      await db.insert(table).values(rows).onConflictDoNothing();
    }
  }
}

function attached(entry: EntryRecord) {
  return attachments(entry).length > 0;
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
    const rows = await db
      .selectDistinct({ entryId: table.entryId })
      .from(table)
      .where(eq(table.conversationId, id));

    const recorded = new Set(rows.map(({ entryId }) => entryId));

    await eachEntry(id, (page) =>
      record(page.filter((entry) => attached(entry) && !recorded.has(entry.id)))
    );
  }
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
        size: table.size,
      })
      .from(table)
      .innerJoin(
        schema.conversation,
        eq(schema.conversation.id, table.conversationId)
      )
      .where(
        and(
          eq(table.ownerId, user.id),
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
      })),
      next: last && rows.length > limit ? cursorFor(last) : null,
    });
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

    const disposition = c.req.valid('query').download ? 'attachment' : 'inline';

    const type =
      item.kind === 'file' ? 'text/plain; charset=utf-8' : item.mimeType;

    return c.body(new Uint8Array(item.content), 200, {
      'cache-control': 'private, max-age=31536000, immutable',
      'content-disposition': `${disposition}; filename*=UTF-8''${encodeURIComponent(item.name)}`,
      'content-type': type,
      'x-content-type-options': 'nosniff',
    });
  });

export default library;
