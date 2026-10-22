import { and, asc, desc, eq, exists, or, sql } from 'drizzle-orm';

import { database } from '../db';
import { member, organization, workspaces } from '../db/schema';

export type Workspace = {
  id: string;
  kind: 'personal' | 'family';
  ownerId: string | null;
  organizationId: string | null;
  name: string;
  createdAt: Date;
};

const columns = {
  id: workspaces.id,
  kind: workspaces.kind,
  ownerId: workspaces.ownerId,
  organizationId: workspaces.organizationId,
  createdAt: workspaces.createdAt,
};

export async function ensurePersonalWorkspace(
  userId: string
): Promise<Workspace> {
  const rows = await database
    .insert(workspaces)
    .values({ kind: 'personal', ownerId: userId })
    .onConflictDoUpdate({
      target: workspaces.ownerId,
      set: { ownerId: userId },
    })
    .returning(columns);

  return { ...rows[0]!, name: 'Personal' };
}

export async function ensureFamilyWorkspace(
  organizationId: string
): Promise<Workspace> {
  const name = database
    .select({ name: organization.name })
    .from(organization)
    .where(eq(organization.id, organizationId));

  const rows = await database
    .insert(workspaces)
    .values({ kind: 'family', organizationId })
    .onConflictDoUpdate({
      target: workspaces.organizationId,
      set: { organizationId },
    })
    .returning({ ...columns, name: sql<string>`(${name})` });

  return rows[0]!;
}

export async function listUserWorkspaces(userId: string): Promise<Workspace[]> {
  const families = await database
    .selectDistinct({ organizationId: member.organizationId })
    .from(member)
    .where(eq(member.userId, userId));

  await database
    .insert(workspaces)
    .values([
      { kind: 'personal', ownerId: userId },
      ...families.map(({ organizationId }) => ({
        kind: 'family' as const,
        organizationId,
      })),
    ])
    .onConflictDoNothing();

  const membership = database
    .select({ id: member.id })
    .from(member)
    .where(
      and(
        eq(member.organizationId, workspaces.organizationId),
        eq(member.userId, userId)
      )
    );

  const rows = await database
    .select({
      ...columns,
      name: sql<string>`case when ${workspaces.kind} = 'personal'
        then 'Personal' else ${organization.name} end`,
    })
    .from(workspaces)
    .leftJoin(organization, eq(organization.id, workspaces.organizationId))
    .where(or(eq(workspaces.ownerId, userId), exists(membership)))
    .orderBy(
      desc(workspaces.kind),
      asc(workspaces.createdAt),
      asc(workspaces.id)
    );

  return rows;
}
