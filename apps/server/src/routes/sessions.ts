import {
  ChatSubmission,
  type ErrorResponse,
  type SessionCreated,
} from '@lab/app-protocol';
import type { Agent, Transport } from '@lab/framework';
import type { SessionSnapshot } from '@lab/harness-pi';
import { SessionId, Value } from '@lab/protocol';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';

import { sessionView } from '../session-view';

export function sessionRoutes(
  agent: Agent<SessionSnapshot>,
  transport: Transport<Request, Response>
) {
  async function readSession(sessionId: string | undefined) {
    if (!Value.Check(SessionId, sessionId)) {
      throw new HTTPException(400, { message: 'Invalid session ID' });
    }

    const snapshot = await agent.readSession(sessionId);

    if (snapshot === undefined) {
      throw new HTTPException(404, { message: 'Session not found' });
    }

    return snapshot;
  }

  return new Hono()
    .onError((error, c) => {
      if (error instanceof HTTPException) {
        return c.json(
          { error: error.message } satisfies ErrorResponse,
          error.status
        );
      }

      console.error(error);

      return c.json(
        {
          error: 'Unable to complete the session request',
        } satisfies ErrorResponse,
        500
      );
    })
    .post('/sessions', async (c) => {
      const sessionId = await agent.createSession();

      return c.json({ sessionId } satisfies SessionCreated, 201);
    })
    .get('/sessions/:sessionId', async (c) =>
      c.json(sessionView(await readSession(c.req.param('sessionId'))))
    )
    .post('/sessions/:sessionId/cancel', async (c) => {
      const sessionId = c.req.param('sessionId');

      await readSession(sessionId);

      await agent.cancelSession(sessionId);

      return c.body(null, 204);
    })
    .post('/chat', async (c) => {
      const body: unknown = await c.req.raw
        .clone()
        .json()
        .catch(() => undefined);

      if (!Value.Check(ChatSubmission, body)) {
        return c.json(
          { error: 'Expected sessionId, requestId, and text' },
          400
        );
      }

      await readSession(body.sessionId);

      return transport.send(c.req.raw);
    })
    .get('/chat', async (c) => {
      await readSession(c.req.query('sessionId'));

      return transport.receive(c.req.raw);
    });
}
