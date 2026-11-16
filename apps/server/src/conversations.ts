import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { applyImmutable } from '@earendil-works/chord/delta';
import {
  AgentDoc,
  type ConversationId,
  type EntryId,
  type SubmissionId,
} from '@earendil-works/pi-durable';
import { getBunServer } from '@hono/bun';
import { schema } from '@lab/db';
import { TitleDoc } from '@lab/harness';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';

import { type User, requireUser } from './auth';
import { db } from './db';
import { harness } from './harness';
import { listConversations, listSchema, running } from './listing';
import {
  draftSchema,
  emptyMessage,
  nonEmpty,
  checkAttachments,
  submitMessage,
} from './messages';
import { defaultModel, findModel, modelChange, models } from './models';
import { thinkingLevelSchema } from './schemas';
import { subscribeStatus } from './status';
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

const listQuery = validator('query', listSchema);

const modelSelection = validator(
  'json',
  z.object({
    id: z.string().min(1),
    provider: z.string().min(1),
    thinkingLevel: thinkingLevelSchema.optional(),
  })
);

const update = validator(
  'json',
  z
    .object({
      archived: z.boolean().optional(),
      pinned: z.boolean().optional(),
      title: z.string().trim().min(1).max(200).optional(),
    })
    .refine(
      (value) => Object.values(value).some((field) => field !== undefined),
      {
        message: 'Nothing to update',
      }
    )
);

function timestamp(value: boolean | undefined) {
  if (value === undefined) {
    return undefined;
  }

  return value ? new Date() : null;
}

type BunServer = {
  timeout(request: Request, seconds: number): void;
};

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
  .get('/', listQuery, async (c) =>
    c.json(await listConversations(c.get('user'), c.req.valid('query')))
  )
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

    checkAttachments(chosen, attachments);

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
      await db.transaction(async (tx) => {
        await tx
          .delete(schema.conversation)
          .where(eq(schema.conversation.id, conversation.id));

        await tx
          .insert(schema.conversationDeletion)
          .values({ id: conversation.id })
          .onConflictDoNothing();
      });

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

      const status = subscribeStatus(conversation.id, (value) =>
        stream.writeSSE({ event: 'status', data: value })
      );

      stream.onAbort(() => {
        status.unsubscribe();
        void watch.stop();
      });

      await stream.writeSSE({
        event: 'value',
        data: JSON.stringify(watch.value),
      });

      let view = watch.value;

      watch.start(async (call) => {
        if (call.kind === 'value') {
          view = applyImmutable(view, call.ops);

          await stream.writeSSE({
            event: 'ops',
            data: JSON.stringify(call.ops),
          });

          void status.report(view);
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

    checkAttachments(
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
  .patch('/:id', params, update, async (c) => {
    const conversation = await load(c.req.valid('param').id, c.get('user'));

    const { archived, pinned, title } = c.req.valid('json');

    if (title !== undefined) {
      await conversation.commit(async (tx) => {
        (await tx.doc(TitleDoc, conversation.id)).title = title;
      }, BACKGROUND_CONTEXT);
    }

    if (archived !== undefined || pinned !== undefined) {
      await db
        .update(schema.conversation)
        .set({ archivedAt: timestamp(archived), pinnedAt: timestamp(pinned) })
        .where(eq(schema.conversation.id, conversation.id));
    }

    return c.body(null, 204);
  })
  .delete('/:id', params, async (c) => {
    const conversation = await load(c.req.valid('param').id, c.get('user'));

    await conversation.abort(BACKGROUND_CONTEXT);

    await db.transaction(async (tx) => {
      await tx
        .delete(schema.conversation)
        .where(eq(schema.conversation.id, conversation.id));

      await tx
        .insert(schema.conversationDeletion)
        .values({ id: conversation.id })
        .onConflictDoNothing();
    });

    return c.body(null, 204);
  });

export default conversations;
