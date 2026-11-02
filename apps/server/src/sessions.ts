import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

import { runtime } from './runtime';

const sessionIdSchema = z.string().regex(/^wrun_[0-9A-HJKMNP-TV-Z]{26}$/);

const submissionSchema = z.strictObject({
  sessionId: sessionIdSchema,
  requestId: z.string().min(1).max(128),
  text: z.string().min(1),
  kind: z.enum(['prompt', 'steer', 'followUp']).optional(),
});

const chat = runtime.chatRoute({ authorize: 'public' });

async function readSession(value: string | undefined) {
  const sessionId = sessionIdSchema.safeParse(value);

  if (!sessionId.success) {
    throw new HTTPException(400, { message: 'Invalid session ID' });
  }

  const snapshot = await runtime.readSession(sessionId.data);

  if (snapshot.eventCount === 0) {
    throw new HTTPException(404, { message: 'Session not found' });
  }

  return snapshot;
}

const sessions = new Hono();

sessions.post('/sessions', async (c) => {
  const sessionId = await runtime.createSession();
  return c.json({ sessionId }, 201);
});

sessions.get('/sessions/:sessionId', async (c) =>
  c.json(await readSession(c.req.param('sessionId')))
);

sessions.post('/sessions/:sessionId/cancel', async (c) => {
  const { sessionId } = await readSession(c.req.param('sessionId'));

  await runtime.cancelSession(sessionId);
  return c.body(null, 204);
});

sessions.post('/chat', async (c) => {
  const body = submissionSchema.safeParse(
    await c.req.raw
      .clone()
      .json()
      .catch(() => undefined)
  );

  if (!body.success) {
    return c.json({ error: 'Expected sessionId, requestId, and text' }, 400);
  }

  await readSession(body.data.sessionId);

  return chat.POST(c.req.raw);
});

sessions.get('/chat', async (c) => {
  await readSession(c.req.query('sessionId'));
  return chat.GET(c.req.raw);
});

export default sessions;
