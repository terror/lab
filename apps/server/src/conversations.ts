import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import type {
  Conversation,
  ConversationId,
  EntryId,
} from '@earendil-works/pi-durable';
import { getBunServer } from '@hono/bun';
import { schema } from '@lab/db';
import { TitleDoc } from '@lab/harness';
import { type AnyColumn, type SQL, and, asc, desc, eq, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';

import { type User, requireUser } from './auth';
import { db } from './db';
import { harness } from './harness';
import { modelChange, thinkingLevelSchema } from './models';
import { flushProjections, project } from './projections';
import { validator } from './validator';

const params = validator(
  'param',
  z.object({ id: z.coerce.number().int().positive() })
);

const attachmentSchema = z.discriminatedUnion('type', [
  z.object({
    data: z.base64().max(8_000_000),
    mimeType: z.enum(['image/gif', 'image/jpeg', 'image/png', 'image/webp']),
    name: z.string().max(200),
    type: z.literal('image'),
  }),
  z.object({
    name: z.string().max(200),
    text: z.string().max(200_000),
    type: z.literal('file'),
  }),
]);

type Attachment = z.infer<typeof attachmentSchema>;

const draftSchema = z.object({
  attachments: z.array(attachmentSchema).max(8).default([]),
  content: z.string().trim(),
});

function nonEmpty(draft: { attachments: Attachment[]; content: string }) {
  return draft.content.length > 0 || draft.attachments.length > 0;
}

const emptyMessage = { message: 'A message needs text or an attachment' };

const message = validator('json', draftSchema.refine(nonEmpty, emptyMessage));

const creation = validator(
  'json',
  draftSchema
    .extend({
      model: z.string().min(1).optional(),
      thinkingLevel: thinkingLevelSchema.optional(),
    })
    .refine(nonEmpty, emptyMessage)
);

const entriesQuery = validator(
  'query',
  z.object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    maxEntryId: z.coerce.number().int().positive().optional(),
    minEntryId: z.coerce.number().int().positive().optional(),
    order: z.enum(['ascending', 'descending']).optional(),
  })
);

const listQuery = validator(
  'query',
  z.object({
    cursor: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    sort: z.enum(['activity', 'created', 'title']).default('activity'),
  })
);

type Sort = 'activity' | 'created' | 'title';

type SortColumns = Record<'createdAt' | 'lastMessageAt' | 'title', AnyColumn>;

const sorts: Record<
  Sort,
  { ascending: boolean; key: (columns: SortColumns) => SQL }
> = {
  activity: {
    ascending: false,
    key: ({ lastMessageAt }) => sql`${lastMessageAt}`,
  },
  created: { ascending: false, key: ({ createdAt }) => sql`${createdAt}` },
  title: {
    ascending: true,
    key: ({ title }) => sql`lower(coalesce(${title}, 'New chat'))`,
  },
};

const modelSelection = validator(
  'json',
  z.object({
    id: z.string().min(1),
    thinkingLevel: thinkingLevelSchema.optional(),
  })
);

const rename = validator(
  'json',
  z.object({ title: z.string().trim().min(1).max(200) })
);

function escape(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function prompt({
  attachments,
  content,
}: {
  attachments: Attachment[];
  content: string;
}) {
  const files = attachments
    .filter((attachment) => attachment.type === 'file')
    .map(({ name, text }) => `<file name="${escape(name)}">\n${text}\n</file>`);

  const images = attachments
    .filter((attachment) => attachment.type === 'image')
    .map(({ data, mimeType }) => ({ data, mimeType, type: 'image' as const }));

  const text = [content, ...files].filter(Boolean).join('\n\n');

  if (images.length === 0) {
    return text;
  }

  return text ? [{ text, type: 'text' as const }, ...images] : images;
}

function submitMessage(
  conversation: Conversation,
  draft: { attachments: Attachment[]; content: string }
) {
  return conversation.submit(
    {
      type: 'input',
      content: prompt(draft),
      entry: {
        kind: 'lab.message',
        data: {
          files: draft.attachments.map(({ name, type }) => ({ name, type })),
          text: draft.content,
        },
      },
    },
    BACKGROUND_CONTEXT
  );
}

type BunServer = {
  timeout(request: Request, seconds: number): void;
};

function after(id: number, user: User, sort: Sort) {
  const { ascending, key } = sorts[sort];

  const cursor = alias(schema.conversation, 'cursor');

  const position = db
    .select({ key: key(cursor), id: cursor.id })
    .from(cursor)
    .where(and(eq(cursor.id, id), eq(cursor.ownerId, user.id)));

  const row = sql`(${key(schema.conversation)}, ${schema.conversation.id})`;

  return ascending ? sql`${row} > (${position})` : sql`${row} < (${position})`;
}

async function load(id: number, user: User) {
  const [record] = await db
    .select({ id: schema.conversation.id })
    .from(schema.conversation)
    .where(
      and(
        eq(schema.conversation.id, id),
        eq(schema.conversation.ownerId, user.id)
      )
    );

  if (!record) {
    throw new HTTPException(404, { message: 'Conversation not found' });
  }

  const conversation = await harness.conversation(
    record.id as ConversationId,
    BACKGROUND_CONTEXT
  );

  if (!conversation) {
    throw new HTTPException(404, { message: 'Conversation not found' });
  }

  return conversation;
}

const conversations = new Hono()
  .use(requireUser)
  .get('/', listQuery, async (c) => {
    const user = c.get('user');

    const { cursor, limit, sort } = c.req.valid('query');

    await flushProjections();

    const { ascending, key } = sorts[sort];

    const order = ascending ? asc : desc;

    const rows = await db
      .select({ id: schema.conversation.id, title: schema.conversation.title })
      .from(schema.conversation)
      .where(
        and(
          eq(schema.conversation.ownerId, user.id),
          cursor === undefined ? undefined : after(cursor, user, sort)
        )
      )
      .orderBy(order(key(schema.conversation)), order(schema.conversation.id))
      .limit(limit + 1);

    const page = rows.slice(0, limit);

    const next = rows.length > limit ? page.at(-1)?.id : undefined;

    return c.json({ conversations: page, next: next ?? null });
  })
  .post('/', creation, async (c) => {
    const user = c.get('user');
    const {
      attachments,
      content: text,
      model,
      thinkingLevel,
    } = c.req.valid('json');

    const change =
      model === undefined ? undefined : modelChange(model, thinkingLevel);

    const conversation = await harness.createConversation(
      { agent: change, ownership: { kind: 'ownerless' } },
      BACKGROUND_CONTEXT
    );

    await db
      .insert(schema.conversation)
      .values({ id: conversation.id, ownerId: user.id });

    await project(conversation.id);

    try {
      await submitMessage(conversation, { attachments, content: text });
    } catch (error) {
      await db
        .delete(schema.conversation)
        .where(eq(schema.conversation.id, conversation.id));

      throw error;
    }

    return c.json({ id: conversation.id }, 201);
  })
  .get('/:id/entries', params, entriesQuery, async (c) => {
    const conversation = await load(c.req.valid('param').id, c.get('user'));

    const { limit, maxEntryId, minEntryId, order } = c.req.valid('query');

    const page = await conversation.entries(
      {
        maxEntryId: maxEntryId as EntryId | undefined,
        minEntryId: minEntryId as EntryId | undefined,
        order,
      },
      limit,
      undefined,
      BACKGROUND_CONTEXT
    );

    return c.json({ items: page.items });
  })
  .get('/:id/events', params, async (c) => {
    const conversation = await load(c.req.valid('param').id, c.get('user'));

    getBunServer<BunServer>(c)?.timeout(c.req.raw, 0);

    return streamSSE(c, async (stream) => {
      const watch = await conversation.watch(BACKGROUND_CONTEXT);

      stream.onAbort(() => void watch.stop());

      await stream.writeSSE({
        event: 'value',
        data: JSON.stringify(watch.value),
      });

      watch.start(async (call) => {
        if (call.kind === 'value') {
          await stream.writeSSE({
            event: 'ops',
            data: JSON.stringify(call.ops),
          });
        }
      });

      const heartbeat = setInterval(() => {
        void stream.write(': ping\n\n');
      }, 25_000);

      await watch.closed;

      clearInterval(heartbeat);
    });
  })
  .post('/:id/messages', params, message, async (c) => {
    const user = c.get('user');

    const conversation = await load(c.req.valid('param').id, user);

    const submission = await submitMessage(conversation, c.req.valid('json'));

    await db
      .update(schema.conversation)
      .set({ lastMessageAt: sql`now()` })
      .where(eq(schema.conversation.id, conversation.id));

    return c.json({ id: submission.id }, 202);
  })
  .put('/:id/model', params, modelSelection, async (c) => {
    const conversation = await load(c.req.valid('param').id, c.get('user'));

    const { id, thinkingLevel } = c.req.valid('json');

    await conversation.configure(
      modelChange(id, thinkingLevel),
      BACKGROUND_CONTEXT
    );

    return c.body(null, 204);
  })
  .post('/:id/abort', params, async (c) => {
    const conversation = await load(c.req.valid('param').id, c.get('user'));

    await conversation.abort(BACKGROUND_CONTEXT);

    return c.body(null, 204);
  })
  .patch('/:id', params, rename, async (c) => {
    const conversation = await load(c.req.valid('param').id, c.get('user'));

    const { title } = c.req.valid('json');

    await conversation.commit(async (tx) => {
      (await tx.doc(TitleDoc, conversation.id)).title = title;
    }, BACKGROUND_CONTEXT);

    return c.body(null, 204);
  })
  .delete('/:id', params, async (c) => {
    const conversation = await load(c.req.valid('param').id, c.get('user'));

    await conversation.abort(BACKGROUND_CONTEXT);

    await db
      .delete(schema.conversation)
      .where(eq(schema.conversation.id, conversation.id));

    return c.body(null, 204);
  });

export default conversations;
