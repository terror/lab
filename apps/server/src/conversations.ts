import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { applyImmutable } from '@earendil-works/chord/delta';
import {
  AgentDoc,
  type Conversation,
  type ConversationId,
  type EntryId,
  type SubmissionId,
} from '@earendil-works/pi-durable';
import { getBunServer } from '@hono/bun';
import { schema } from '@lab/db';
import { TitleDoc } from '@lab/harness';
import {
  type AnyColumn,
  type SQL,
  and,
  asc,
  desc,
  eq,
  ilike,
  sql,
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';

import { type User, requireUser } from './auth';
import { db } from './db';
import { harness } from './harness';
import {
  acceptsImages,
  defaultModel,
  findModel,
  modelChange,
  models,
} from './models';
import { flushProjections } from './projections';
import {
  type Attachment,
  attachmentSchema,
  sortSchema,
  thinkingLevelSchema,
} from './schemas';
import { StatusReporter } from './status';
import { validator } from './validator';

const params = validator(
  'param',
  z.object({ id: z.coerce.number().int().positive() })
);

const submissionParams = validator(
  'param',
  z.object({
    id: z.coerce.number().int().positive(),
    submissionId: z.coerce.number().int().positive(),
  })
);

const draftSchema = z.object({
  attachments: z.array(attachmentSchema).max(8).default([]),
  content: z.string().trim(),
});

function nonEmpty(draft: { attachments: Attachment[]; content: string }) {
  return draft.content.length > 0 || draft.attachments.length > 0;
}

const emptyMessage = { message: 'A message needs text or an attachment' };

const message = validator(
  'json',
  draftSchema
    .extend({ steer: z.boolean().default(false) })
    .refine(nonEmpty, emptyMessage)
);

const creation = validator(
  'json',
  draftSchema
    .extend({
      model: z
        .object({ id: z.string().min(1), provider: z.string().min(1) })
        .optional(),
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
    search: z.string().trim().min(1).max(200).optional(),
    sort: sortSchema.default('activity'),
  })
);

type Sort = z.infer<typeof sortSchema>;

type SortColumns = Record<'createdAt' | 'lastMessageAt' | 'title', AnyColumn>;

const sorts: Record<
  Sort,
  { ascending: boolean; keys: (columns: SortColumns) => SQL[] }
> = {
  activity: {
    ascending: false,
    keys: ({ lastMessageAt }) => [sql`${lastMessageAt}`],
  },
  created: { ascending: false, keys: ({ createdAt }) => [sql`${createdAt}`] },
  title: {
    ascending: true,
    keys: ({ title }) => [
      sql`${title} is null`,
      sql`lower(coalesce(${title}, ''))`,
    ],
  },
};

const modelSelection = validator(
  'json',
  z.object({
    id: z.string().min(1),
    provider: z.string().min(1),
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

function requireImageInput(
  model: Parameters<typeof acceptsImages>[0],
  attachments: Attachment[]
) {
  if (
    attachments.some(({ type }) => type === 'image') &&
    !acceptsImages(model)
  ) {
    throw new HTTPException(400, { message: 'This model can’t read images' });
  }
}

function submitMessage(
  conversation: Conversation,
  draft: { attachments: Attachment[]; content: string },
  whenBusy: 'followUp' | 'steer' = 'followUp'
) {
  return conversation.submit(
    {
      type: 'input',
      whenBusy,
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

function matching(search: string) {
  const pattern = search.replace(/[\\%_]/g, (character) => `\\${character}`);

  return ilike(schema.conversation.title, `%${pattern}%`);
}

function after(id: number, user: User, sort: Sort) {
  const { ascending, keys } = sorts[sort];

  const cursor = alias(schema.conversation, 'cursor');

  const position = db
    .select({ ...Object.fromEntries(keys(cursor).entries()), id: cursor.id })
    .from(cursor)
    .where(and(eq(cursor.id, id), eq(cursor.ownerId, user.id)));

  const columns = [
    ...keys(schema.conversation),
    sql`${schema.conversation.id}`,
  ];

  const row = sql`(${sql.join(columns, sql`, `)})`;

  return ascending ? sql`${row} > (${position})` : sql`${row} < (${position})`;
}

async function running() {
  const { tasks } = await harness.inspect(BACKGROUND_CONTEXT);

  return new Set<number>(
    tasks
      .filter(({ record }) => !record.background)
      .map(({ record }) => record.conversationId)
  );
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

    const { cursor, limit, search, sort } = c.req.valid('query');

    await flushProjections();

    const { ascending, keys } = sorts[sort];

    const order = ascending ? asc : desc;

    const rows = await db
      .select({ id: schema.conversation.id, title: schema.conversation.title })
      .from(schema.conversation)
      .where(
        and(
          eq(schema.conversation.ownerId, user.id),
          cursor === undefined ? undefined : after(cursor, user, sort),
          search === undefined ? undefined : matching(search)
        )
      )
      .orderBy(
        ...keys(schema.conversation).map((key) => order(key)),
        order(schema.conversation.id)
      )
      .limit(limit + 1);

    const page = rows.slice(0, limit);

    const next = rows.length > limit ? page.at(-1)?.id : undefined;

    const busy = await running();

    return c.json({
      conversations: page.map((row) => ({ ...row, running: busy.has(row.id) })),
      next: next ?? null,
    });
  })
  .post('/', creation, async (c) => {
    const user = c.get('user');
    const {
      attachments,
      content: text,
      model,
      thinkingLevel,
    } = c.req.valid('json');

    const chosen = model
      ? await findModel(model.provider, model.id)
      : await defaultModel();

    if (!chosen) {
      throw new HTTPException(400, {
        message: 'Add a provider in settings to start chatting',
      });
    }

    const change = modelChange(chosen, thinkingLevel);

    requireImageInput(chosen, attachments);

    const conversation = await harness.createConversation(
      { agent: change, ownership: { kind: 'ownerless' } },
      BACKGROUND_CONTEXT
    );

    await db
      .insert(schema.conversation)
      .values({ id: conversation.id, ownerId: user.id });

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
  .get('/:id', params, async (c) => {
    const conversation = await load(c.req.valid('param').id, c.get('user'));

    const doc = await harness.snapshot(
      TitleDoc,
      conversation.id,
      BACKGROUND_CONTEXT
    );

    const busy = await running();

    return c.json({
      id: conversation.id,
      running: busy.has(conversation.id),
      title: doc?.title ?? null,
    });
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

      const aborted = new AbortController();

      stream.onAbort(() => {
        aborted.abort();
        void watch.stop();
      });

      await stream.writeSSE({
        event: 'value',
        data: JSON.stringify(watch.value),
      });

      const reporter = new StatusReporter(
        (status) => stream.writeSSE({ event: 'status', data: status }),
        aborted.signal
      );

      let view = watch.value;

      watch.start(async (call) => {
        if (call.kind === 'value') {
          view = applyImmutable(view, call.ops);

          await stream.writeSSE({
            event: 'ops',
            data: JSON.stringify(call.ops),
          });

          void reporter.report(view);
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
    const conversation = await load(c.req.valid('param').id, c.get('user'));

    const { steer, ...draft } = c.req.valid('json');

    const agent = await harness.snapshot(
      AgentDoc,
      conversation.id,
      BACKGROUND_CONTEXT
    );

    requireImageInput(
      agent?.model &&
        models.getModel(agent.model.provider, agent.model.modelId),
      draft.attachments
    );

    const submission = await submitMessage(
      conversation,
      draft,
      steer ? 'steer' : 'followUp'
    );

    return c.json({ id: submission.id }, 202);
  })
  .delete('/:id/submissions/:submissionId', submissionParams, async (c) => {
    const { id, submissionId } = c.req.valid('param');

    const conversation = await load(id, c.get('user'));

    const result = await harness.abortSubmission(
      submissionId as SubmissionId,
      BACKGROUND_CONTEXT,
      conversation.id
    );

    if (result === 'not_found') {
      throw new HTTPException(404, { message: 'Message not found' });
    }

    if (result !== 'aborted') {
      throw new HTTPException(409, { message: 'Message was already sent' });
    }

    return c.body(null, 204);
  })
  .put('/:id/model', params, modelSelection, async (c) => {
    const conversation = await load(c.req.valid('param').id, c.get('user'));

    const { id, provider, thinkingLevel } = c.req.valid('json');

    await conversation.configure(
      modelChange(await findModel(provider, id), thinkingLevel),
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
