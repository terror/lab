import { zValidator } from '@hono/zod-validator';
import {
  type ChatAccepted,
  type ChatSubmission,
  type SessionCreated,
  type SessionSnapshot,
  httpError,
  readableErrorMessage,
  sessionAccessSchema,
  sessionCreationSchema,
  sessionMoveSchema,
  sessionUpdateSchema,
  sessionVisibilityUpdateSchema,
  submissionSchema,
} from '@lab/shared';
import { chatRoute, openWorldReader } from 'durable-harness/pi-durable';
import { type Context, Hono, type TypedResponse } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { streamSSE } from 'hono/streaming';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { z } from 'zod';

import {
  type Api,
  type Principal,
  principal,
  rejectInvalidInput,
  workspaceIdSchema,
} from '../auth/access';
import { models } from '../harness/agent';
import { open, storage, world } from '../harness/runtime';
import { abortSession } from '../harness/session-lifecycle';
import { sessionSnapshot } from '../services/session-snapshot';
import {
  type Session,
  createSession,
  deleteSession,
  getSession,
  grantSessionAccess,
  listSessionAccess,
  listSessions,
  listSharedSessions,
  moveSession,
  renameSession,
  revokeSessionAccess,
  sessionMetadata,
  setSessionVisibility,
} from '../services/sessions';
import {
  completeSubmission,
  listSubmissions,
  reserveSubmission,
} from '../services/submissions';

const sessionParams = submissionSchema.pick({ sessionId: true });
const sessionAccessParams = sessionParams.extend({ userId: z.uuid() });
const sessionListQuery = z.object({ workspaceId: workspaceIdSchema });
const sessionSubmissionSchema = submissionSchema.omit({ sessionId: true });

function sessionJson<T extends SessionSnapshot | ChatAccepted>(
  c: Context<Api>,
  value: T
): Response & TypedResponse<T, 200, 'json'> {
  return c.newResponse(JSON.stringify(value), 200, {
    'Content-Type': 'application/json; charset=UTF-8',
  }) as Response & TypedResponse<T, 200, 'json'>;
}

function chat(request: Request, session: Session) {
  return chatRoute({
    open,
    agent: session.configuration,
    ...storage,
    authorize: (candidate, sessionId) => {
      if (candidate !== request || sessionId !== session.sessionId) {
        throw Response.json({ error: httpError(404).message }, { status: 404 });
      }
    },
  });
}

async function submitChat(
  principal: Principal,
  input: ChatSubmission,
  source: Request
) {
  const session = await getSession(principal, input.sessionId, 'contribute');
  const model = session.configuration.model;

  if (!models.getModel(model.provider, model.modelId)) {
    throw new HTTPException(400, {
      message:
        'This chat’s model is unavailable. Start a new chat to use the current model.',
    });
  }

  await reserveSubmission(principal, session.sessionId, input);

  const observer = new AbortController();

  const headers = new Headers(source.headers);
  headers.set('Content-Type', 'application/json');
  headers.delete('Content-Length');

  const request = new Request(source, {
    headers,
    body: JSON.stringify(input),
    signal: AbortSignal.any([source.signal, observer.signal]),
  });

  const response = await chat(request, session)
    .POST(request)
    .catch((error) => {
      observer.abort();

      throw error;
    });

  const submissionId = response.headers.get('x-submission-id');

  if (response.ok && submissionId) {
    void completeSubmission(
      session.sessionId,
      input.requestId,
      submissionId
    ).catch((error) =>
      console.error('Could not record accepted submission', error)
    );
  }

  return { session, response, submissionId, observer };
}

async function acceptChat({
  session,
  response,
  submissionId,
  observer,
}: Awaited<ReturnType<typeof submitChat>>): Promise<ChatAccepted> {
  try {
    if (!response.ok) {
      const status =
        response.status >= 400 && response.status < 600
          ? (response.status as ContentfulStatusCode)
          : 502;

      const text = await response.text().catch(() => '');

      throw new HTTPException(status, {
        message: readableErrorMessage(text, httpError(status).message),
        cause: new Error(text),
      });
    }
  } finally {
    observer.abort();
    void response.body?.cancel().catch(() => undefined);
  }

  if (!submissionId) {
    throw new HTTPException(502, {
      message:
        'Your message hasn’t been confirmed. Retry sending to check it safely.',
    });
  }

  const reader = openWorldReader(session.sessionId, { world });
  await reader.refresh();

  return {
    submissionId,
    snapshot: sessionSnapshot(session, await reader.snapshot()),
  };
}

const sessions = new Hono<Api>()
  .get(
    '/sessions',
    zValidator('query', sessionListQuery, rejectInvalidInput),
    async (c) => {
      const { workspaceId } = c.req.valid('query');

      const sessions = await listSessions(c.get('principal'), workspaceId);

      return c.json(sessions.map(sessionMetadata));
    }
  )
  .post(
    '/sessions',
    zValidator('json', sessionCreationSchema, rejectInvalidInput),
    async (c) => {
      return c.json(
        {
          sessionId: await createSession(
            c.get('principal'),
            c.req.valid('json')
          ),
        } satisfies SessionCreated,
        201
      );
    }
  )
  .get('/sessions/shared', async (c) => {
    const sessions = await listSharedSessions(c.get('principal'));

    return c.json(sessions.map(sessionMetadata));
  })
  .get(
    '/sessions/:sessionId',
    zValidator('param', sessionParams, rejectInvalidInput),
    async (c): Promise<TypedResponse<SessionSnapshot, 200, 'json'>> => {
      const { sessionId } = c.req.valid('param');

      const session = await getSession(c.get('principal'), sessionId);
      const reader = openWorldReader(session.sessionId, { world });
      await reader.refresh();

      return sessionJson(c, sessionSnapshot(session, await reader.snapshot()));
    }
  )
  .get(
    '/sessions/:sessionId/events',
    zValidator('param', sessionParams, rejectInvalidInput),
    async (c) => {
      const { sessionId } = c.req.valid('param');

      const session = await getSession(c.get('principal'), sessionId);
      const reader = openWorldReader(session.sessionId, { world });

      c.header('X-Accel-Buffering', 'no');

      return streamSSE(c, async (stream) => {
        let lastSent = 0;
        let lastMetadata = '';

        try {
          while (!stream.aborted) {
            const changed = await reader.refresh();
            const snapshot = await reader.snapshot();
            const current = await principal(c.req.raw);

            if (current.userId !== c.get('principal').userId) {
              throw new HTTPException(401);
            }

            const session = await getSession(current, sessionId);
            const metadata = JSON.stringify(sessionMetadata(session));

            if (changed || lastSent === 0 || metadata !== lastMetadata) {
              await stream.writeSSE({
                event: 'snapshot',
                data: JSON.stringify(sessionSnapshot(session, snapshot)),
              });

              lastSent = Date.now();
              lastMetadata = metadata;

              if (!snapshot.unfinished) {
                await stream.writeSSE({ event: 'end', data: '{}' });
                return;
              }
            } else if (Date.now() - lastSent >= 15_000) {
              await stream.writeSSE({ event: 'ping', data: '{}' });
              lastSent = Date.now();
            }

            await stream.sleep(200);
          }
        } catch (error) {
          if (
            error instanceof HTTPException &&
            [401, 403, 404].includes(error.status)
          ) {
            await stream.writeSSE({
              event: 'access-revoked',
              data: JSON.stringify({
                status: error.status === 401 ? 401 : 403,
              }),
            });
            return;
          }

          throw error;
        }
      });
    }
  )
  .patch(
    '/sessions/:sessionId',
    zValidator('param', sessionParams, rejectInvalidInput),
    zValidator('json', sessionUpdateSchema, rejectInvalidInput),
    async (c) => {
      const { sessionId } = c.req.valid('param');
      const { title } = c.req.valid('json');

      const session = await renameSession(c.get('principal'), sessionId, title);

      return c.json(sessionMetadata(session));
    }
  )
  .delete(
    '/sessions/:sessionId',
    zValidator('param', sessionParams, rejectInvalidInput),
    async (c) => {
      await deleteSession(c.get('principal'), c.req.valid('param').sessionId);

      return c.body(null, 204);
    }
  )
  .post(
    '/sessions/:sessionId/cancel',
    zValidator('param', sessionParams, rejectInvalidInput),
    async (c) => {
      const session = await getSession(
        c.get('principal'),
        c.req.valid('param').sessionId,
        'contribute'
      );

      await abortSession(session);

      return c.body(null, 204);
    }
  )
  .get(
    '/sessions/:sessionId/access',
    zValidator('param', sessionParams, rejectInvalidInput),
    async (c) => {
      return c.json(
        await listSessionAccess(
          c.get('principal'),
          c.req.valid('param').sessionId
        )
      );
    }
  )
  .put(
    '/sessions/:sessionId/access/:userId',
    zValidator('param', sessionAccessParams, rejectInvalidInput),
    zValidator('json', sessionAccessSchema, rejectInvalidInput),
    async (c) => {
      const { sessionId, userId } = c.req.valid('param');
      const { role } = c.req.valid('json');

      await grantSessionAccess(c.get('principal'), sessionId, userId, role);

      return c.body(null, 204);
    }
  )
  .delete(
    '/sessions/:sessionId/access/:userId',
    zValidator('param', sessionAccessParams, rejectInvalidInput),
    async (c) => {
      const { sessionId, userId } = c.req.valid('param');

      await revokeSessionAccess(c.get('principal'), sessionId, userId);

      return c.body(null, 204);
    }
  )
  .patch(
    '/sessions/:sessionId/visibility',
    zValidator('param', sessionParams, rejectInvalidInput),
    zValidator('json', sessionVisibilityUpdateSchema, rejectInvalidInput),
    async (c) => {
      const { sessionId } = c.req.valid('param');
      const { visibility } = c.req.valid('json');

      const session = await setSessionVisibility(
        c.get('principal'),
        sessionId,
        visibility
      );

      return c.json(sessionMetadata(session));
    }
  )
  .post(
    '/sessions/:sessionId/move',
    zValidator('param', sessionParams, rejectInvalidInput),
    zValidator('json', sessionMoveSchema, rejectInvalidInput),
    async (c) => {
      const { sessionId } = c.req.valid('param');
      const { workspaceId } = c.req.valid('json');

      const session = await moveSession(
        c.get('principal'),
        sessionId,
        workspaceId
      );

      return c.json(sessionMetadata(session));
    }
  )
  .get(
    '/sessions/:sessionId/submissions',
    zValidator('param', sessionParams, rejectInvalidInput),
    async (c) => {
      const session = await getSession(
        c.get('principal'),
        c.req.valid('param').sessionId
      );

      return c.json(await listSubmissions(session.sessionId));
    }
  )
  .post(
    '/sessions/:sessionId/submissions',
    zValidator('param', sessionParams, rejectInvalidInput),
    zValidator('json', sessionSubmissionSchema, rejectInvalidInput),
    async (c): Promise<TypedResponse<ChatAccepted, 200, 'json'>> => {
      const turn = await submitChat(
        c.get('principal'),
        { ...c.req.valid('json'), ...c.req.valid('param') },
        c.req.raw
      );

      return sessionJson(c, await acceptChat(turn));
    }
  );

export default sessions;
