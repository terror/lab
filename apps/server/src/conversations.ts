import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import type {
  Conversation,
  ConversationId,
  EntryId,
} from '@earendil-works/pi-durable';
import { getBunServer } from '@hono/bun';
import { schema } from '@lab/db';
import { TitleDoc } from '@lab/harness';
import { and, desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';

import { type User, requireUser } from './auth';
import { db } from './db';
import { harness } from './harness';
import { chatModels } from './models';
import { validator } from './validator';

const params = validator(
  'param',
  z.object({ id: z.coerce.number().int().positive() })
);

const content = z.string().trim().min(1);

const message = validator('json', z.object({ content }));

const creation = validator(
  'json',
  z.object({ content, model: z.string().min(1).optional() })
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

const modelChange = validator('json', z.object({ id: z.string().min(1) }));

function findModel(id: string) {
  const model = chatModels.find(({ modelId }) => modelId === id);

  if (!model) {
    throw new HTTPException(400, { message: 'Unknown model' });
  }

  return { provider: model.provider, modelId: model.modelId };
}

function submitMessage(conversation: Conversation, user: User, text: string) {
  return conversation.submit(
    {
      type: 'input',
      content: text,
      entry: {
        kind: 'lab.message',
        data: { author: { id: user.id, name: user.name } },
      },
    },
    BACKGROUND_CONTEXT
  );
}

type BunServer = {
  timeout(request: Request, seconds: number): void;
};

async function load(id: number, ownerId: string) {
  const [row] = await db
    .select({ id: schema.conversation.id })
    .from(schema.conversation)
    .where(
      and(
        eq(schema.conversation.id, id),
        eq(schema.conversation.ownerId, ownerId)
      )
    );

  if (!row) {
    throw new HTTPException(404, { message: 'Conversation not found' });
  }

  const conversation = await harness.conversation(
    row.id as ConversationId,
    BACKGROUND_CONTEXT
  );

  if (!conversation) {
    throw new HTTPException(404, { message: 'Conversation not found' });
  }

  return conversation;
}

const conversations = new Hono()
  .use(requireUser)
  .get('/', async (c) => {
    const rows = await db
      .select({ id: schema.conversation.id })
      .from(schema.conversation)
      .where(eq(schema.conversation.ownerId, c.get('user').id))
      .orderBy(desc(schema.conversation.createdAt))
      .limit(50);

    const items = await Promise.all(
      rows.map(async ({ id }) => {
        const doc = await harness.snapshot(
          TitleDoc,
          id as ConversationId,
          BACKGROUND_CONTEXT
        );

        return { id, title: doc?.title ?? null };
      })
    );

    return c.json({ conversations: items });
  })
  .post('/', creation, async (c) => {
    const user = c.get('user');
    const { content: text, model } = c.req.valid('json');

    const ref = model === undefined ? undefined : findModel(model);

    const conversation = await harness.createConversation(
      { ownership: { kind: 'ownerless' } },
      BACKGROUND_CONTEXT
    );

    await db
      .insert(schema.conversation)
      .values({ id: conversation.id, ownerId: user.id });

    if (ref) {
      await conversation.configure({ model: ref }, BACKGROUND_CONTEXT);
    }

    await submitMessage(conversation, user, text);

    return c.json({ id: conversation.id }, 201);
  })
  .get('/:id/entries', params, entriesQuery, async (c) => {
    const conversation = await load(c.req.valid('param').id, c.get('user').id);

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
    const conversation = await load(c.req.valid('param').id, c.get('user').id);

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

    const conversation = await load(c.req.valid('param').id, user.id);

    const submission = await submitMessage(
      conversation,
      user,
      c.req.valid('json').content
    );

    return c.json({ id: submission.id }, 202);
  })
  .put('/:id/model', params, modelChange, async (c) => {
    const conversation = await load(c.req.valid('param').id, c.get('user').id);

    await conversation.configure(
      { model: findModel(c.req.valid('json').id) },
      BACKGROUND_CONTEXT
    );

    return c.body(null, 204);
  })
  .post('/:id/abort', params, async (c) => {
    const conversation = await load(c.req.valid('param').id, c.get('user').id);

    await conversation.abort(BACKGROUND_CONTEXT);

    return c.body(null, 204);
  });

export default conversations;
