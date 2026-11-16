import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import type {
  Conversation,
  ConversationId,
  Cursor,
  EntryRecord,
} from '@earendil-works/pi-durable';
import { schema } from '@lab/db';
import { and, asc, desc, eq, ilike, inArray, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

import { requireUser } from './auth';
import { db } from './db';
import { fileTexts } from './files';
import { harness } from './harness';
import { validator } from './validator';

const table = schema.libraryItem;

const BACKFILL = 'library';

const PREVIEW_LENGTH = 400;

const dataSchema = z.object({
  files: z
    .array(z.object({ name: z.string(), type: z.enum(['file', 'image']) }))
    .default([]),
  text: z.string().default(''),
});

type Item = Omit<typeof table.$inferInsert, 'id'>;

function blocks(text: string, content: string) {
  if (!content) {
    return text;
  }

  const prefix = `${content}\n\n`;

  return text.startsWith(prefix) ? text.slice(prefix.length) : '';
}

function items(entry: EntryRecord, ownerId: string): Item[] {
  const data = dataSchema.safeParse(entry.data).data;

  const message = entry.model?.[0];

  if (entry.kind !== 'lab.message' || !data || message?.role !== 'user') {
    return [];
  }

  const parts =
    typeof message.content === 'string'
      ? [{ text: message.content, type: 'text' as const }]
      : message.content;

  const images = parts.flatMap((part) => (part.type === 'image' ? [part] : []));

  const text = parts.find((part) => part.type === 'text')?.text ?? '';

  const files = data.files.map((file, position) => ({ ...file, position }));

  const named = files.filter(({ type }) => type === 'file');

  const texts = fileTexts(
    blocks(text, data.text),
    named.map(({ name }) => name)
  );

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

  const fileItems = named.flatMap(({ name, position }, index) => {
    const body = texts[index];

    if (body === undefined) {
      return [];
    }

    const content = new TextEncoder().encode(body);

    return [
      {
        ...base,
        content,
        kind: 'file' as const,
        mimeType: 'text/plain',
        name,
        position,
        preview: body.slice(0, PREVIEW_LENGTH),
        size: content.byteLength,
      },
    ];
  });

  return [...imageItems, ...fileItems];
}

async function record(entries: readonly EntryRecord[]) {
  const ids = [...new Set(entries.map(({ conversationId }) => conversationId))];

  const owners = new Map(
    (
      await db
        .select({
          id: schema.conversation.id,
          ownerId: schema.conversation.ownerId,
        })
        .from(schema.conversation)
        .where(inArray(schema.conversation.id, ids))
    ).map(({ id, ownerId }) => [id, ownerId])
  );

  const rows = entries.flatMap((entry) => {
    const ownerId = owners.get(entry.conversationId);

    return ownerId ? items(entry, ownerId) : [];
  });

  if (rows.length > 0) {
    await db.insert(table).values(rows).onConflictDoNothing();
  }
}

let pending = Promise.resolve();

harness.observeCommits({
  advance: ({ changes }) => {
    const entries = changes
      .flatMap((change) => (change.type === 'entry' ? [change.value] : []))
      .filter((entry) => entry.kind === 'lab.message');

    if (entries.length > 0) {
      pending = pending.then(() => record(entries).catch(console.error));
    }
  },
  end: () => undefined,
});

export function flushLibrary() {
  return pending;
}

async function recordHistory(conversation: Conversation, cursor?: Cursor) {
  const page = await conversation.entries(
    { order: 'ascending' },
    100,
    cursor,
    BACKGROUND_CONTEXT
  );

  await record(page.items.filter((entry) => entry.kind === 'lab.message'));

  if (page.next !== undefined) {
    await recordHistory(conversation, page.next);
  }
}

export async function backfillLibrary() {
  const [done] = await db
    .select()
    .from(schema.backfill)
    .where(eq(schema.backfill.name, BACKFILL));

  if (done) {
    return;
  }

  const conversations = await db
    .select({ id: schema.conversation.id })
    .from(schema.conversation);

  for (const { id } of conversations) {
    const conversation = await harness.conversation(
      id as ConversationId,
      BACKGROUND_CONTEXT
    );

    if (conversation) {
      await recordHistory(conversation);
    }
  }

  await db.insert(schema.backfill).values({ name: BACKFILL });
}

const listing = validator(
  'query',
  z.object({
    cursor: z.coerce.number().int().positive().optional(),
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

function matching(search: string) {
  const pattern = search.replace(/[\\%_]/g, (character) => `\\${character}`);

  return ilike(table.name, `%${pattern}%`);
}

function after(id: number, ownerId: string) {
  return sql`(${table.createdAt}, ${table.entryId}, -${table.position}) < (
    select created_at, entry_id, -position from ${table}
    where id = ${id} and owner_id = ${ownerId}
  )`;
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
        id: table.id,
        kind: table.kind,
        mimeType: table.mimeType,
        name: table.name,
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
          search === undefined ? undefined : matching(search),
          cursor === undefined ? undefined : after(cursor, user.id)
        )
      )
      .orderBy(desc(table.createdAt), desc(table.entryId), asc(table.position))
      .limit(limit + 1);

    const page = rows.slice(0, limit);

    return c.json({
      items: page.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
      })),
      next: rows.length > limit ? (page.at(-1)?.id ?? null) : null,
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
