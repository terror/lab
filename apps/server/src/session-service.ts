import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { openWorldStorage } from 'durable-harness/pi-durable';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

import { type Ownership, type Principal, authorize } from './access';
import { type AgentConfiguration, agent } from './agent';
import { database } from './database';
import { storage } from './runtime';

export type Session = Ownership & {
  sessionId: string;
  title: string;
  configuration: AgentConfiguration;
  createdAt: Date;
  updatedAt: Date;
};

export type SessionMetadata = Ownership & {
  sessionId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export const sessionIdSchema = z
  .string()
  .regex(/^wrun_[0-9A-HJKMNP-TV-Z]{26}$/);

const columns =
  '"sessionId", "ownerId", "workspaceId", title, configuration, "createdAt", "updatedAt"';

export function sessionMetadata(session: Session): SessionMetadata {
  return {
    sessionId: session.sessionId,
    ownerId: session.ownerId,
    workspaceId: session.workspaceId,
    title: session.title,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}

export async function getSession(
  principal: Principal,
  value: string | undefined
) {
  const sessionId = sessionIdSchema.safeParse(value);

  if (!sessionId.success) {
    throw new HTTPException(400, { message: 'Invalid session ID' });
  }

  const { rows } = await database.query<Session>(
    `SELECT ${columns} FROM lab.sessions WHERE "sessionId" = $1`,
    [sessionId.data]
  );

  const session = rows[0];

  if (!session) {
    throw new HTTPException(404, { message: 'Not found' });
  }

  await authorize(principal, session);

  return session;
}

export async function listSessions(
  principal: Principal,
  workspaceId: string | null
) {
  await authorize(principal, { ownerId: principal.userId, workspaceId });

  const { rows } = await database.query<Session>(
    `SELECT ${columns} FROM lab.sessions
     WHERE ($1::uuid IS NULL AND "workspaceId" IS NULL AND "ownerId" = $2)
        OR ($1::uuid IS NOT NULL AND "workspaceId" = $1)
     ORDER BY "updatedAt" DESC, "sessionId" DESC`,
    [workspaceId, principal.userId]
  );

  return rows;
}

export async function createSession(
  principal: Principal,
  input: { workspaceId: string | null; title: string }
) {
  await authorize(principal, {
    ownerId: principal.userId,
    workspaceId: input.workspaceId,
  });

  const session = await openWorldStorage(undefined, storage);

  try {
    await database.query(
      `INSERT INTO lab.sessions
         ("sessionId", "ownerId", "workspaceId", title, configuration)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        session.sessionId,
        principal.userId,
        input.workspaceId,
        input.title,
        agent,
      ]
    );

    return session.sessionId;
  } finally {
    await session.close(BACKGROUND_CONTEXT);
  }
}

export async function renameSession(
  principal: Principal,
  sessionId: string,
  title: string
) {
  const session = await getSession(principal, sessionId);

  const { rows } = await database.query<Session>(
    `UPDATE lab.sessions
     SET title = $2, "updatedAt" = GREATEST("updatedAt", now())
     WHERE "sessionId" = $1 RETURNING ${columns}`,
    [session.sessionId, title]
  );

  const renamed = rows[0];

  if (!renamed) {
    throw new HTTPException(404, { message: 'Not found' });
  }

  return renamed;
}

export async function recordSessionActivity(session: Session) {
  await database.query(
    `UPDATE lab.sessions SET "updatedAt" = GREATEST("updatedAt", now())
     WHERE "sessionId" = $1`,
    [session.sessionId]
  );
}
