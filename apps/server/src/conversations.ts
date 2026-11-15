import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import type { ConversationId } from '@earendil-works/pi-durable';
import { getBunServer } from '@hono/bun';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';

import { harness } from './harness';
import { validator } from './validator';

const params = validator(
  'param',
  z.object({ id: z.coerce.number().int().positive() })
);

const message = validator(
  'json',
  z.object({ content: z.string().trim().min(1) })
);

type BunServer = {
  timeout(request: Request, seconds: number): void;
};

async function load(id: number) {
  const conversation = await harness.conversation(
    id as ConversationId,
    BACKGROUND_CONTEXT
  );

  if (!conversation) {
    throw new HTTPException(404, { message: 'Conversation not found' });
  }

  return conversation;
}

const conversations = new Hono()
  .get('/', async (c) => {
    const page = await harness.commit(
      (tx) => tx.scanConversations({ order: 'descending' }, 50),
      BACKGROUND_CONTEXT
    );

    return c.json({
      conversations: page.items
        .filter((conversation) => !conversation.owner)
        .map((conversation) => ({ id: conversation.id })),
    });
  })
  .post('/', async (c) => {
    const conversation = await harness.createConversation(
      { ownership: { kind: 'ownerless' } },
      BACKGROUND_CONTEXT
    );

    return c.json({ id: conversation.id }, 201);
  })
  .get('/:id/events', params, async (c) => {
    const conversation = await load(c.req.valid('param').id);

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
    const conversation = await load(c.req.valid('param').id);

    const submission = await conversation.submit(
      { type: 'input', content: c.req.valid('json').content },
      BACKGROUND_CONTEXT
    );

    return c.json({ id: submission.id }, 202);
  })
  .post('/:id/abort', params, async (c) => {
    const conversation = await load(c.req.valid('param').id);

    await conversation.abort(BACKGROUND_CONTEXT);

    return c.body(null, 204);
  });

export default conversations;
