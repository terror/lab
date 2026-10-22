import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import type { SessionCreation, SessionMetadata, Workspace } from '@lab/shared';
import {
  and,
  desc,
  eq,
  getTableColumns,
  isNotNull,
  ne,
  sql,
} from 'drizzle-orm';
import { openWorldStorage } from 'durable-harness/pi-durable';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

import {
  type Principal,
  type SessionAction,
  type SessionRole,
  type SessionVisibility,
  authorizeWorkspace,
  lockSession,
  requireSessionRole,
  sessionIdSchema,
  sessionPermissions,
  sessionRoleSchema,
  sessionVisibilitySchema,
} from '../auth/access';
import { type Database, database } from '../db';
import {
  member,
  sessionAccess,
  sessions,
  user,
  workspaces,
} from '../db/schema';
import { type AgentConfiguration, agent } from '../harness/agent';
import { storage } from '../harness/runtime';
import { closeSession } from '../harness/session-lifecycle';
import { ensurePersonalWorkspace } from './workspaces';

export { sessionIdSchema };

export type Session = Omit<SessionMetadata, 'createdAt' | 'updatedAt'> & {
  configuration: AgentConfiguration;
  createdAt: Date;
  updatedAt: Date;
};

function selectSessions(principal: Principal, client: Database = database) {
  const permissions = sessionPermissions(principal, client);

  return client
    .select({
      ...getTableColumns(sessions),
      workspaceKind: workspaces.kind,
      ownerId: workspaces.ownerId,
      organizationId: workspaces.organizationId,
      role: permissions.role,
      canTransfer: permissions.canTransfer,
    })
    .from(sessions)
    .innerJoin(workspaces, eq(workspaces.id, sessions.workspaceId))
    .leftJoin(
      sessionAccess,
      and(
        eq(sessionAccess.sessionId, sessions.sessionId),
        eq(sessionAccess.userId, principal.userId)
      )
    );
}

export function sessionMetadata(session: Session): SessionMetadata {
  return {
    sessionId: session.sessionId,
    workspaceId: session.workspaceId,
    workspaceKind: session.workspaceKind,
    ownerId: session.ownerId,
    organizationId: session.organizationId,
    createdById: session.createdById,
    visibility: session.visibility,
    role: session.role,
    canTransfer: session.canTransfer,
    title: session.title,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}

export async function getSession(
  principal: Principal,
  value: string | undefined,
  action: SessionAction = 'read',
  client: Database = database
) {
  const sessionId = sessionIdSchema.safeParse(value);

  if (!sessionId.success) {
    throw new HTTPException(400, { message: 'Invalid session ID' });
  }

  if (client !== database) {
    await lockSession(principal, sessionId.data, client);
  }

  const rows = await selectSessions(principal, client).where(
    eq(sessions.sessionId, sessionId.data)
  );

  const session = rows[0];

  if (!session) {
    throw new HTTPException(404);
  }

  return { ...session, role: requireSessionRole(session.role, action) };
}

export async function listSessions(
  principal: Principal,
  workspaceId: string | null
) {
  const workspace = await authorizeWorkspace(
    principal,
    workspaceId ?? (await ensurePersonalWorkspace(principal.userId)).id
  );

  const rows = await selectSessions(principal)
    .where(
      and(
        eq(sessions.workspaceId, workspace.id),
        isNotNull(sessionPermissions(principal).role)
      )
    )
    .orderBy(desc(sessions.updatedAt), desc(sessions.sessionId));

  return rows.map((session) => ({
    ...session,
    role: requireSessionRole(session.role, 'read'),
  }));
}

export async function listSharedSessions(principal: Principal) {
  const rows = await selectSessions(principal)
    .where(
      and(
        eq(workspaces.kind, 'personal'),
        ne(workspaces.ownerId, principal.userId),
        isNotNull(sessionPermissions(principal).role)
      )
    )
    .orderBy(desc(sessions.updatedAt), desc(sessions.sessionId));

  return rows.map((session) => ({
    ...session,
    role: requireSessionRole(session.role, 'read'),
  }));
}

export async function createSession(
  principal: Principal,
  input: SessionCreation
) {
  const workspace = await authorizeWorkspace(
    principal,
    input.workspaceId ?? (await ensurePersonalWorkspace(principal.userId)).id
  );

  const visibility = sessionVisibilitySchema.parse(
    input.visibility ?? 'restricted'
  );

  requireVisibility(workspace.kind, visibility);

  const session = await openWorldStorage(undefined, storage);

  try {
    await database.transaction(async (client) => {
      await authorizeWorkspace(principal, workspace.id, false, client);

      await client.insert(sessions).values({
        sessionId: session.sessionId,
        workspaceId: workspace.id,
        createdById: principal.userId,
        visibility,
        title: input.title,
        configuration: agent,
      });

      if (workspace.kind === 'family') {
        await client.insert(sessionAccess).values({
          sessionId: session.sessionId,
          userId: principal.userId,
          role: 'manager',
        });
      }
    });

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
  return changeSession(principal, sessionId, async (client, session) => {
    await client
      .update(sessions)
      .set({
        title,
        updatedAt: sql`GREATEST(${sessions.updatedAt} + interval '1 millisecond', now())`,
      })
      .where(eq(sessions.sessionId, session.sessionId));

    return getSession(principal, session.sessionId, 'manage', client);
  });
}

export async function deleteSession(principal: Principal, sessionId: string) {
  const session = await getSession(principal, sessionId, 'manage');

  await closeSession(session);

  await changeSession(principal, sessionId, async (client, session) => {
    await client
      .delete(sessions)
      .where(eq(sessions.sessionId, session.sessionId));
  });
}

export async function listSessionAccess(
  principal: Principal,
  sessionId: string
) {
  return changeSession(principal, sessionId, async (client, session) => {
    return client
      .select({
        userId: sessionAccess.userId,
        role: sessionAccess.role,
        name: user.name,
        email: user.email,
      })
      .from(sessionAccess)
      .innerJoin(user, eq(user.id, sessionAccess.userId))
      .where(eq(sessionAccess.sessionId, session.sessionId))
      .orderBy(sessionAccess.userId);
  });
}

export async function grantSessionAccess(
  principal: Principal,
  sessionId: string,
  userId: string,
  role: SessionRole
) {
  userId = z.uuid().parse(userId);

  role = sessionRoleSchema.parse(role);

  return changeSession(principal, sessionId, async (client, session) => {
    const users = await client
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, userId))
      .for('key share');

    if (!users.length) {
      throw new HTTPException(404);
    }

    if (session.workspaceKind === 'family') {
      const members = await client
        .select({ id: member.id })
        .from(member)
        .where(
          and(
            eq(member.organizationId, session.organizationId!),
            eq(member.userId, userId)
          )
        )
        .orderBy(member.id)
        .for('share');

      if (!members.length) {
        throw new HTTPException(400, {
          message: 'The user must be a member of this workspace',
        });
      }
    }

    await client
      .insert(sessionAccess)
      .values({ sessionId: session.sessionId, userId, role })
      .onConflictDoUpdate({
        target: [sessionAccess.sessionId, sessionAccess.userId],
        set: { role },
      });

    await client
      .update(sessions)
      .set({
        updatedAt: sql`GREATEST(${sessions.updatedAt} + interval '1 millisecond', now())`,
      })
      .where(eq(sessions.sessionId, session.sessionId));

    return { userId, role };
  });
}

export async function revokeSessionAccess(
  principal: Principal,
  sessionId: string,
  userId: string
) {
  userId = z.uuid().parse(userId);

  await changeSession(principal, sessionId, async (client, session) => {
    await client
      .delete(sessionAccess)
      .where(
        and(
          eq(sessionAccess.sessionId, session.sessionId),
          eq(sessionAccess.userId, userId)
        )
      );

    await client
      .update(sessions)
      .set({
        updatedAt: sql`GREATEST(${sessions.updatedAt} + interval '1 millisecond', now())`,
      })
      .where(eq(sessions.sessionId, session.sessionId));
  });
}

export async function setSessionVisibility(
  principal: Principal,
  sessionId: string,
  visibility: SessionVisibility
) {
  visibility = sessionVisibilitySchema.parse(visibility);

  return changeSession(principal, sessionId, async (client, session) => {
    requireVisibility(session.workspaceKind, visibility);

    await client
      .update(sessions)
      .set({
        visibility,
        updatedAt: sql`GREATEST(${sessions.updatedAt} + interval '1 millisecond', now())`,
      })
      .where(eq(sessions.sessionId, session.sessionId));

    return getSession(principal, session.sessionId, 'manage', client);
  });
}

export async function moveSession(
  principal: Principal,
  sessionId: string,
  workspaceId: string
) {
  workspaceId = z.uuid().parse(workspaceId);

  return changeSession(principal, sessionId, async (client, session) => {
    if (!session.canTransfer) {
      throw new HTTPException(403);
    }

    const workspace = await authorizeWorkspace(
      principal,
      workspaceId,
      true,
      client
    );

    if (workspace.id === session.workspaceId) {
      return session;
    }

    await client
      .delete(sessionAccess)
      .where(eq(sessionAccess.sessionId, session.sessionId));

    await client
      .update(sessions)
      .set({
        workspaceId: workspace.id,
        visibility: 'restricted',
        updatedAt: sql`GREATEST(${sessions.updatedAt} + interval '1 millisecond', now())`,
      })
      .where(eq(sessions.sessionId, session.sessionId));

    return getSession(principal, session.sessionId, 'manage', client);
  });
}

function requireVisibility(
  kind: Workspace['kind'],
  visibility: SessionVisibility
) {
  if (kind === 'personal' && visibility === 'workspace') {
    throw new HTTPException(400, {
      message: 'Personal sessions must use restricted visibility',
    });
  }
}

async function changeSession<T>(
  principal: Principal,
  sessionId: string,
  operation: (client: Database, session: Session) => Promise<T>
) {
  return database.transaction(async (client) => {
    const session = await getSession(principal, sessionId, 'manage', client);

    return operation(client, session);
  });
}
