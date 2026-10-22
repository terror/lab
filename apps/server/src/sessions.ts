import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import {
  acquireHarness,
  chatRoute,
  openWorldReader,
  openWorldStorage,
} from 'durable-harness/pi-durable';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

import {
  type Api,
  type Ownership,
  type Principal,
  authorize,
  principal,
  workspaceIdSchema,
} from './access';
import { agent } from './agent';
import { database } from './database';
import { open, world } from './runtime';

type Session = Ownership & {
  sessionId: string;
  title: string;
  configuration: typeof agent;
  createdAt: Date;
  updatedAt: Date;
};

const sessionIdSchema = z.string().regex(/^wrun_[0-9A-HJKMNP-TV-Z]{26}$/);

const creationSchema = z.strictObject({
  workspaceId: workspaceIdSchema,
  title: z.string().trim().max(200).default(''),
});

const updateSchema = z.strictObject({
  title: z.string().trim().max(200),
});

const submissionSchema = z.strictObject({
  sessionId: sessionIdSchema,
  requestId: z.string().min(1).max(128),
  text: z.string().min(1),
  kind: z.enum(['prompt', 'steer', 'followUp']).optional(),
});

const storage = { world, traceAudience: 'private' as const };

async function readSession(principal: Principal, value: string | undefined) {
  const sessionId = sessionIdSchema.safeParse(value);

  if (!sessionId.success) {
    throw new HTTPException(400, { message: 'Invalid session ID' });
  }

  const { rows } = await database.query<Session>(
    'SELECT * FROM lab.sessions WHERE "sessionId" = $1',
    [sessionId.data]
  );

  const session = rows[0];

  if (!session) {
    throw new HTTPException(404, { message: 'Not found' });
  }

  await authorize(principal, session);

  return session;
}

function chat(session: Session) {
  return chatRoute({
    open,
    agent: session.configuration,
    ...storage,
    authorize: async (request, sessionId) => {
      try {
        if (sessionId !== session.sessionId) {
          throw new HTTPException(404, { message: 'Not found' });
        }

        await readSession(await principal(request), sessionId);
      } catch (error) {
        if (error instanceof HTTPException) {
          throw Response.json(
            { error: error.message },
            { status: error.status }
          );
        }

        throw error;
      }
    },
  });
}

const sessions = new Hono<Api>();

sessions.get('/sessions', async (c) => {
  const principal = c.get('principal');

  const workspaceId = workspaceIdSchema.parse(c.req.query('workspaceId'));

  await authorize(principal, { ownerId: principal.userId, workspaceId });

  const { rows } = await database.query<Session>(
    `SELECT * FROM lab.sessions
     WHERE ($1::uuid IS NULL AND "workspaceId" IS NULL AND "ownerId" = $2)
        OR ($1::uuid IS NOT NULL AND "workspaceId" = $1)
     ORDER BY "createdAt" DESC, "sessionId"`,
    [workspaceId, principal.userId]
  );

  return c.json(rows);
});

sessions.post('/sessions', async (c) => {
  const principal = c.get('principal');

  const text = await c.req.text();
  const body = creationSchema.parse(text ? JSON.parse(text) : {});

  await authorize(principal, {
    ownerId: principal.userId,
    workspaceId: body.workspaceId,
  });

  const session = await openWorldStorage(undefined, storage);

  try {
    await database.query(
      `INSERT INTO lab.sessions
         ("sessionId", "ownerId", "workspaceId", title, configuration)
       VALUES ($1, $2, $3, $4, $5)`,
      [session.sessionId, principal.userId, body.workspaceId, body.title, agent]
    );

    return c.json({ sessionId: session.sessionId }, 201);
  } finally {
    await session.close(BACKGROUND_CONTEXT);
  }
});

sessions.get('/sessions/:sessionId', async (c) => {
  const session = await readSession(
    c.get('principal'),
    c.req.param('sessionId')
  );

  const reader = openWorldReader(session.sessionId, { world });
  await reader.refresh();

  return c.json({ ...(await reader.snapshot()), metadata: session });
});

sessions.patch('/sessions/:sessionId', async (c) => {
  const body = updateSchema.parse(await c.req.json());

  const session = await readSession(
    c.get('principal'),
    c.req.param('sessionId')
  );

  const { rows } = await database.query<Session>(
    `UPDATE lab.sessions SET title = $2, "updatedAt" = now()
     WHERE "sessionId" = $1 RETURNING *`,
    [session.sessionId, body.title]
  );

  return c.json(rows[0]!);
});

sessions.post('/sessions/:sessionId/cancel', async (c) => {
  const session = await readSession(
    c.get('principal'),
    c.req.param('sessionId')
  );

  for (let attempt = 0; ; attempt++) {
    const lease = await acquireHarness(session.sessionId, open, storage);

    try {
      const root = await lease.harness.root(BACKGROUND_CONTEXT, {
        agent: session.configuration,
      });

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

  const session = await readSession(c.get('principal'), body.data.sessionId);

  return chat(session).POST(c.req.raw);
});

sessions.get('/chat', async (c) => {
  const session = await readSession(
    c.get('principal'),
    c.req.query('sessionId')
  );

  return chat(session).GET(c.req.raw);
});

export default sessions;
