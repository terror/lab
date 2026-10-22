import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import {
  acquireHarness,
  chatRoute,
  openWorldReader,
} from 'durable-harness/pi-durable';
import { Hono } from 'hono';
import { z } from 'zod';

import {
  type Api,
  sessionRoleSchema,
  sessionVisibilitySchema,
  workspaceIdSchema,
} from '../auth/access';
import { open, storage, world } from '../harness/runtime';
import {
  type Session,
  createSession,
  getSession,
  grantSessionAccess,
  listSessionAccess,
  listSessions,
  listSharedSessions,
  moveSession,
  renameSession,
  revokeSessionAccess,
  sessionIdSchema,
  sessionMetadata,
  setSessionVisibility,
} from '../services/sessions';
import {
  completeSubmission,
  listSubmissions,
  reserveSubmission,
} from '../services/submissions';

const creationSchema = z.strictObject({
  workspaceId: workspaceIdSchema,
  title: z.string().trim().max(200).default(''),
  visibility: sessionVisibilitySchema.default('restricted'),
});

const updateSchema = z.strictObject({
  title: z.string().trim().max(200),
});

const accessSchema = z.strictObject({ role: sessionRoleSchema });
const visibilitySchema = z.strictObject({
  visibility: sessionVisibilitySchema,
});
const moveSchema = z.strictObject({ workspaceId: z.uuid() });

const submissionSchema = z.strictObject({
  sessionId: sessionIdSchema,
  requestId: z.string().min(1).max(128),
  text: z.string().min(1),
  kind: z.enum(['prompt', 'steer', 'followUp']).optional(),
});

function chat(request: Request, session: Session) {
  return chatRoute({
    open,
    agent: session.configuration,
    ...storage,
    authorize: (candidate, sessionId) => {
      if (candidate !== request || sessionId !== session.sessionId) {
        throw Response.json({ error: 'Not found' }, { status: 404 });
      }
    },
  });
}

const sessions = new Hono<Api>();

sessions.get('/sessions', async (c) => {
  const workspaceId = workspaceIdSchema.parse(c.req.query('workspaceId'));

  const sessions = await listSessions(c.get('principal'), workspaceId);

  return c.json(sessions.map(sessionMetadata));
});

sessions.post('/sessions', async (c) => {
  const text = await c.req.text();

  const body = creationSchema.parse(text ? JSON.parse(text) : {});

  return c.json(
    { sessionId: await createSession(c.get('principal'), body) },
    201
  );
});

sessions.get('/sessions/shared', async (c) => {
  const sessions = await listSharedSessions(c.get('principal'));

  return c.json(sessions.map(sessionMetadata));
});

sessions.get('/sessions/:sessionId', async (c) => {
  const session = await getSession(
    c.get('principal'),
    c.req.param('sessionId')
  );

  const reader = openWorldReader(session.sessionId, { world });
  await reader.refresh();

  return c.json({
    ...(await reader.snapshot()),
    metadata: sessionMetadata(session),
  });
});

sessions.patch('/sessions/:sessionId', async (c) => {
  const body = updateSchema.parse(await c.req.json());

  const session = await renameSession(
    c.get('principal'),
    c.req.param('sessionId'),
    body.title
  );

  return c.json(sessionMetadata(session));
});

sessions.post('/sessions/:sessionId/cancel', async (c) => {
  const session = await getSession(
    c.get('principal'),
    c.req.param('sessionId'),
    'contribute'
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

sessions.get('/sessions/:sessionId/access', async (c) => {
  return c.json(
    await listSessionAccess(c.get('principal'), c.req.param('sessionId'))
  );
});

sessions.put('/sessions/:sessionId/access/:userId', async (c) => {
  const body = accessSchema.parse(await c.req.json());

  await grantSessionAccess(
    c.get('principal'),
    c.req.param('sessionId'),
    z.uuid().parse(c.req.param('userId')),
    body.role
  );

  return c.body(null, 204);
});

sessions.delete('/sessions/:sessionId/access/:userId', async (c) => {
  await revokeSessionAccess(
    c.get('principal'),
    c.req.param('sessionId'),
    z.uuid().parse(c.req.param('userId'))
  );

  return c.body(null, 204);
});

sessions.patch('/sessions/:sessionId/visibility', async (c) => {
  const body = visibilitySchema.parse(await c.req.json());

  const session = await setSessionVisibility(
    c.get('principal'),
    c.req.param('sessionId'),
    body.visibility
  );

  return c.json(sessionMetadata(session));
});

sessions.post('/sessions/:sessionId/move', async (c) => {
  const body = moveSchema.parse(await c.req.json());

  const session = await moveSession(
    c.get('principal'),
    c.req.param('sessionId'),
    body.workspaceId
  );

  return c.json(sessionMetadata(session));
});

sessions.get('/sessions/:sessionId/submissions', async (c) => {
  const session = await getSession(
    c.get('principal'),
    c.req.param('sessionId')
  );

  return c.json(await listSubmissions(session.sessionId));
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

  const principal = c.get('principal');

  const session = await getSession(
    principal,
    body.data.sessionId,
    'contribute'
  );

  await reserveSubmission(principal, session.sessionId, body.data);

  const response = await chat(c.req.raw, session).POST(c.req.raw);

  const submissionId = response.headers.get('x-submission-id');

  if (response.ok && submissionId) {
    void completeSubmission(
      session.sessionId,
      body.data.requestId,
      submissionId
    ).catch((error) =>
      console.error('Could not record accepted submission', error)
    );
  }

  return response;
});

sessions.get('/chat', async (c) => {
  const session = await getSession(
    c.get('principal'),
    c.req.query('sessionId')
  );

  return chat(c.req.raw, session).GET(c.req.raw);
});

export default sessions;
