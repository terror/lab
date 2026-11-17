import { schema } from '@lab/db';
import type { ProjectAccess } from '@lab/harness';
import { and, asc, eq, sql } from 'drizzle-orm';

import { db } from './db';
import { conversationOwner } from './records';

export const PROJECT_LIMIT = 100;

const table = schema.project;

const fields = { id: table.id, name: table.name };

export type Project = { id: number; name: string };

function owned(ownerId: string, id: number) {
  return and(eq(table.id, id), eq(table.ownerId, ownerId));
}

export async function listProjects(ownerId: string): Promise<Project[]> {
  return db
    .select(fields)
    .from(table)
    .where(eq(table.ownerId, ownerId))
    .orderBy(asc(sql`lower(${table.name})`), asc(table.id));
}

export async function createProject(
  ownerId: string,
  name: string
): Promise<Project | undefined> {
  const [{ count } = { count: 0 }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(table)
    .where(eq(table.ownerId, ownerId));

  if (count >= PROJECT_LIMIT) {
    return undefined;
  }

  const [row] = await db
    .insert(table)
    .values({ name, ownerId })
    .returning(fields);

  return row;
}

export async function renameProject(
  ownerId: string,
  id: number,
  name: string
): Promise<Project | undefined> {
  const [row] = await db
    .update(table)
    .set({ name })
    .where(owned(ownerId, id))
    .returning(fields);

  return row;
}

export async function moveChat(
  ownerId: string,
  chatId: number,
  projectId: number | null
) {
  const target =
    projectId === null
      ? sql`true`
      : sql`exists (select 1 from ${table} where ${owned(ownerId, projectId)})`;

  const rows = await db
    .update(schema.conversation)
    .set({ projectId })
    .where(
      and(
        eq(schema.conversation.id, chatId),
        eq(schema.conversation.ownerId, ownerId),
        target
      )
    )
    .returning({ id: schema.conversation.id });

  return rows.length > 0;
}

async function owner(conversationId: number) {
  const ownerId = await conversationOwner(conversationId);

  if (!ownerId) {
    throw new Error('This chat has no owner.');
  }

  return ownerId;
}

export const projectAccess: ProjectAccess = {
  create: async (conversationId, name) =>
    createProject(await owner(conversationId), name),
  current: async (conversationId) => {
    const [row] = await db
      .select(fields)
      .from(schema.conversation)
      .innerJoin(table, eq(table.id, schema.conversation.projectId))
      .where(eq(schema.conversation.id, conversationId));

    return row;
  },
  list: async (conversationId) => listProjects(await owner(conversationId)),
  move: async (conversationId, chatId, projectId) => {
    const ownerId = await owner(conversationId);

    if (!(await moveChat(ownerId, chatId, projectId))) {
      return undefined;
    }

    const [chat] = await db
      .select({ id: schema.conversation.id, title: schema.conversation.title })
      .from(schema.conversation)
      .where(eq(schema.conversation.id, chatId));

    const project =
      (await listProjects(ownerId)).find(({ id }) => id === projectId) ?? null;

    return chat && { chat, project };
  },
  rename: async (conversationId, id, name) =>
    renameProject(await owner(conversationId), id, name),
};
