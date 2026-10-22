import {
  type SessionRole,
  sessionIdSchema,
  sessionRoleSchema,
  sessionVisibilitySchema,
  workspaceIdSchema,
} from '@lab/shared';
import { and, eq, exists, or, sql } from 'drizzle-orm';
import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

import { type Database, database } from '../db';
import {
  member,
  organization,
  sessionAccess,
  sessions,
  workspaces,
} from '../db/schema';
import type { Workspace } from '../services/workspaces';
import { auth } from './index';

export {
  sessionIdSchema,
  sessionRoleSchema,
  sessionVisibilitySchema,
  workspaceIdSchema,
};
export type { SessionRole, SessionVisibility } from '@lab/shared';

export type Principal = {
  userId: string;
  headers: Headers;
};

export type SessionAction = 'read' | 'contribute' | 'manage';

export type Api = {
  Variables: { principal: Principal };
};

export function rejectInvalidInput(result: { success: boolean }) {
  if (!result.success) {
    throw new HTTPException(400);
  }
}

function membershipPermissions(principal: Principal, client: Database) {
  const membership = and(
    eq(member.organizationId, workspaces.organizationId),
    eq(member.userId, principal.userId)
  );

  const manages = sql<boolean>`regexp_split_to_array(trim(${member.role}),
    '[[:space:]]*,[[:space:]]*') && ARRAY['owner', 'admin']`;

  return {
    present: exists(
      client.select({ id: member.id }).from(member).where(membership)
    ),
    manages: exists(
      client
        .select({ id: member.id })
        .from(member)
        .where(and(membership, manages))
    ),
  };
}

export function sessionPermissions(
  principal: Principal,
  client: Database = database
) {
  const membership = membershipPermissions(principal, client);

  const ownsPersonalWorkspace = and(
    eq(workspaces.kind, 'personal'),
    eq(workspaces.ownerId, principal.userId)
  );

  return {
    role: sql<SessionRole | null>`CASE
      WHEN ${ownsPersonalWorkspace} THEN 'manager'
      WHEN ${workspaces.kind} = 'personal' THEN ${sessionAccess.role}
      WHEN NOT ${membership.present} THEN NULL
      WHEN ${membership.manages} THEN 'manager'
      WHEN ${sessionAccess.role} IS NOT NULL THEN ${sessionAccess.role}
      WHEN ${sessions.visibility} = 'workspace' THEN 'editor'
      ELSE NULL
    END`,
    canTransfer: sql<boolean>`${or(
      ownsPersonalWorkspace,
      and(eq(workspaces.kind, 'family'), membership.manages)
    )}`,
  };
}

export async function principal(request: Request): Promise<Principal> {
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session) {
    throw new HTTPException(401);
  }

  return { userId: session.user.id, headers: request.headers };
}

export const authenticate = createMiddleware<Api>(async (c, next) => {
  c.set('principal', await principal(c.req.raw));
  await next();
});

export function requireSessionRole(
  role: SessionRole | null | undefined,
  action: SessionAction
): SessionRole {
  if (!role) {
    throw new HTTPException(404);
  }

  if (
    (action === 'contribute' && role === 'viewer') ||
    (action === 'manage' && role !== 'manager')
  ) {
    throw new HTTPException(403);
  }

  return role;
}

export async function lockSession(
  principal: Principal,
  sessionId: string,
  client: Database
) {
  await client
    .select({ sessionId: sessions.sessionId })
    .from(sessions)
    .where(eq(sessions.sessionId, sessionId))
    .for('update');

  await client
    .select({ id: member.id })
    .from(member)
    .innerJoin(workspaces, eq(workspaces.organizationId, member.organizationId))
    .innerJoin(sessions, eq(sessions.workspaceId, workspaces.id))
    .where(
      and(
        eq(sessions.sessionId, sessionId),
        eq(member.userId, principal.userId)
      )
    )
    .orderBy(member.id)
    .for('share', { of: member });
}

export async function authorizeWorkspace(
  principal: Principal,
  workspaceId: string,
  manage = false,
  client: Database = database
): Promise<Workspace> {
  workspaceId = z.uuid().parse(workspaceId);

  if (client !== database) {
    await client
      .select({ id: member.id })
      .from(member)
      .innerJoin(
        workspaces,
        eq(workspaces.organizationId, member.organizationId)
      )
      .where(
        and(eq(workspaces.id, workspaceId), eq(member.userId, principal.userId))
      )
      .orderBy(member.id)
      .for('share', { of: member });
  }

  const membership = membershipPermissions(principal, client);

  const rows = await client
    .select({
      id: workspaces.id,
      kind: workspaces.kind,
      ownerId: workspaces.ownerId,
      organizationId: workspaces.organizationId,
      createdAt: workspaces.createdAt,
      name: sql<string>`CASE WHEN ${workspaces.kind} = 'personal'
        THEN 'Personal' ELSE ${organization.name} END`,
      present: sql<boolean>`${membership.present}`,
      manages: sql<boolean>`${membership.manages}`,
    })
    .from(workspaces)
    .leftJoin(organization, eq(organization.id, workspaces.organizationId))
    .where(eq(workspaces.id, workspaceId));

  const workspace = rows[0];

  if (
    !workspace ||
    (workspace.kind === 'personal' && workspace.ownerId !== principal.userId) ||
    (workspace.kind === 'family' && !workspace.present)
  ) {
    throw new HTTPException(404);
  }

  if (manage && workspace.kind === 'family' && !workspace.manages) {
    throw new HTTPException(403);
  }

  return {
    id: workspace.id,
    kind: workspace.kind,
    ownerId: workspace.ownerId,
    organizationId: workspace.organizationId,
    name: workspace.name,
    createdAt: workspace.createdAt,
  };
}
