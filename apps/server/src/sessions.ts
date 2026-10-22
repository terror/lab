import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import {
  acquireHarness,
  chatRoute,
  openWorldReader,
} from 'durable-harness/pi-durable';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

import { agent } from './agent';
import { open, world } from './runtime';

const sessionIdSchema = z.string().regex(/^wrun_[0-9A-HJKMNP-TV-Z]{26}$/);

const submissionSchema = z.strictObject({
  sessionId: sessionIdSchema,
  requestId: z.string().min(1).max(128),
  text: z.string().min(1),
  kind: z.enum(['prompt', 'steer', 'followUp']).optional(),
});

const storage = { world, traceAudience: 'private' as const };
const chat = chatRoute({ open, agent, ...storage, authorize: 'public' });

async function readSession(value: string | undefined) {
  const sessionId = sessionIdSchema.safeParse(value);

  if (!sessionId.success) {
    throw new HTTPException(400, { message: 'Invalid session ID' });
  }

  const reader = openWorldReader(sessionId.data, { world });
  await reader.refresh();

  const snapshot = await reader.snapshot();

  if (snapshot.eventCount === 0) {
    throw new HTTPException(404, { message: 'Session not found' });
  }

  return snapshot;
}

const sessions = new Hono();

sessions.post('/sessions', async (c) => {
  const lease = await acquireHarness(undefined, open, storage);

  try {
    await lease.harness.root(BACKGROUND_CONTEXT, { agent });
    return c.json({ sessionId: lease.storage.sessionId }, 201);
  } finally {
    await lease.release();
  }
});

sessions.get('/sessions/:sessionId', async (c) =>
  c.json(await readSession(c.req.param('sessionId')))
);

sessions.post('/sessions/:sessionId/cancel', async (c) => {
  const { sessionId } = await readSession(c.req.param('sessionId'));

  for (let attempt = 0; ; attempt++) {
    const lease = await acquireHarness(sessionId, open, storage);

    try {
      const root = await lease.harness.root(BACKGROUND_CONTEXT);
      await root.abort(BACKGROUND_CONTEXT, { background: true });
      return c.body(null, 204);
    } catch (error) {
      if (attempt === 0 && lease.storage.isFenced) {
        continue;
      }

      throw error;
    } finally {
      await lease.release();
    }
  }
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
