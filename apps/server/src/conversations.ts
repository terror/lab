import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import type { ConversationId } from '@earendil-works/pi-durable';
import { getBunServer } from '@hono/bun';
import { schema } from '@lab/db';
import { TitleDoc } from '@lab/harness';
import { and, desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';

import { requireUser } from './auth';
import { db } from './db';
import { harness } from './harness';
import { chatModels } from './models';
import { validator } from './validator';

const params = validator(
  'param',
  z.object({ id: z.coerce.number().int().positive() })
);

const message = validator(
  'json',
  z.object({ content: z.string().trim().min(1) })
);

const modelChange = validator('json', z.object({ id: z.string().min(1) }));

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
  .post('/', async (c) => {
    const conversation = await harness.createConversation(
      { ownership: { kind: 'ownerless' } },
      BACKGROUND_CONTEXT
    );

    await db
      .insert(schema.conversation)
      .values({ id: conversation.id, ownerId: c.get('user').id });

    return c.json({ id: conversation.id }, 201);
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

      await watch.closed;
    });
  })
  .post('/:id/messages', params, message, async (c) => {
    const user = c.get('user');

    const conversation = await load(c.req.valid('param').id, user.id);

    const submission = await conversation.submit(
      {
        type: 'input',
        content: c.req.valid('json').content,
        entry: {
          kind: 'lab.message',
          data: { author: { id: user.id, name: user.name } },
        },
      },
      BACKGROUND_CONTEXT
    );

    return c.json({ id: submission.id }, 202);
  })
  .put('/:id/model', params, modelChange, async (c) => {
    const conversation = await load(c.req.valid('param').id, c.get('user').id);

    const model = chatModels.find(
      ({ modelId }) => modelId === c.req.valid('json').id
    );

    if (!model) {
      throw new HTTPException(400, { message: 'Unknown model' });
    }

    await conversation.configure(
      { model: { provider: model.provider, modelId: model.modelId } },
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
