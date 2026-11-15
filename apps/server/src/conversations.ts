import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import type { ConversationId } from '@earendil-works/pi-durable';
import { getBunServer } from '@hono/bun';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { streamSSE } from 'hono/streaming';
import { validator } from 'hono/validator';
import { z } from 'zod';

import { harness } from './harness';

const paramsSchema = z.object({ id: z.coerce.number().int().positive() });

const messageSchema = z.object({ content: z.string().trim().min(1) });

const params = validator('param', (value) => {
  const result = paramsSchema.safeParse(value);

  if (!result.success) {
    throw new HTTPException(404);
  }

  return result.data;
});

const message = validator('json', (value) => {
  const result = messageSchema.safeParse(value);

  if (!result.success) {
    throw new HTTPException(400, { message: z.prettifyError(result.error) });
  }

  return result.data;
});

async function load(id: number) {
  const conversation = await harness.conversation(
    id as ConversationId,
    BACKGROUND_CONTEXT
  );

  if (!conversation) {
    throw new HTTPException(404);
  }

  return conversation;
}

const conversations = new Hono();

conversations.get('/', async (c) => {
  const page = await harness.commit(
    (tx) => tx.scanConversations({ order: 'descending' }, 50),
    BACKGROUND_CONTEXT
  );

  return c.json({
    conversations: page.items
      .filter((conversation) => !conversation.owner)
      .map((conversation) => ({ id: conversation.id })),
  });
});

conversations.post('/', async (c) => {
  const conversation = await harness.createConversation(
    { ownership: { kind: 'ownerless' } },
    BACKGROUND_CONTEXT
  );

  return c.json({ id: conversation.id }, 201);
});

conversations.get('/:id/events', params, async (c) => {
  const conversation = await load(c.req.valid('param').id);

  getBunServer<Bun.Server<undefined>>(c)?.timeout(c.req.raw, 0);

  return streamSSE(c, async (stream) => {
    const watch = await conversation.watch(BACKGROUND_CONTEXT);

    stream.onAbort(() => void watch.stop());

    await stream.writeSSE({
      event: 'value',
      data: JSON.stringify(watch.value),
    });

    watch.start(async (call) => {
      if (call.kind === 'value') {
        await stream.writeSSE({ event: 'ops', data: JSON.stringify(call.ops) });
      }
    });

    await watch.closed;
  });
});

conversations.post('/:id/messages', params, message, async (c) => {
  const conversation = await load(c.req.valid('param').id);

  const submission = await conversation.submit(
    { type: 'input', content: c.req.valid('json').content },
    BACKGROUND_CONTEXT
  );

  return c.json({ id: submission.id }, 202);
});

conversations.post('/:id/abort', params, async (c) => {
  const conversation = await load(c.req.valid('param').id);

  await conversation.abort(BACKGROUND_CONTEXT);

  return c.body(null, 204);
});

export default conversations;
