import { schema } from '@lab/db';
import type { ProjectAccess } from '@lab/harness';
import { and, asc, eq, isNotNull, isNull, sql } from 'drizzle-orm';

import { db } from './db';
import { conversationOwner } from './records';

export const PROJECT_LIMIT = 100;

const table = schema.project;

const fields = {
  id: table.id,
  instructions: table.instructions,
  name: table.name,
};

export type Project = { id: number; instructions: string; name: string };

export type ProjectChange = { instructions?: string; name?: string };

function live(ownerId: string) {
  return and(eq(table.ownerId, ownerId), isNull(table.deletedAt));
}

function owned(ownerId: string, id: number) {
  return and(eq(table.id, id), live(ownerId));
}

export async function listProjects(ownerId: string): Promise<Project[]> {
  return db
    .select(fields)
    .from(table)
    .where(live(ownerId))
    .orderBy(asc(sql`lower(${table.name})`), asc(table.id));
}

export async function createProject(
  ownerId: string,
  name: string
): Promise<Project | undefined> {
  const [{ count } = { count: 0 }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(table)
    .where(live(ownerId));

  if (count >= PROJECT_LIMIT) {
    return undefined;
  }

  const [row] = await db
    .insert(table)
    .values({ name, ownerId })
    .returning(fields);

  return row;
}

export async function updateProject(
  ownerId: string,
  id: number,
  change: ProjectChange
): Promise<Project | undefined> {
  const [row] = await db
    .update(table)
    .set(change)
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
        isNull(schema.conversation.deletedAt),
        target
      )
    )
    .returning({ id: schema.conversation.id });

  return rows.length > 0;
}

export async function trashProject(ownerId: string, id: number) {
  return db.transaction(async (tx) => {
    const deletedAt = new Date();

    const [trashed] = await tx
      .update(table)
      .set({ deletedAt })
      .where(owned(ownerId, id))
      .returning({ id: table.id });

    if (!trashed) {
      return undefined;
    }

    const chats = await tx
      .update(schema.conversation)
      .set({ deletedAt })
      .where(
        and(
          eq(schema.conversation.projectId, id),
          isNull(schema.conversation.deletedAt)
        )
      )
      .returning({ id: schema.conversation.id });

    return chats.map((chat) => chat.id);
  });
}

export async function restoreProject(ownerId: string, id: number) {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ deletedAt: table.deletedAt })
      .from(table)
      .where(
        and(
          eq(table.id, id),
          eq(table.ownerId, ownerId),
          isNotNull(table.deletedAt)
        )
      );

    if (!row?.deletedAt) {
      return false;
    }

    await tx.update(table).set({ deletedAt: null }).where(eq(table.id, id));

    await tx
      .update(schema.conversation)
      .set({ deletedAt: null })
      .where(
        and(
          eq(schema.conversation.projectId, id),
          eq(schema.conversation.deletedAt, row.deletedAt)
        )
      );

    return true;
  });
}

async function owner(conversationId: number) {
  const ownerId = await conversationOwner(conversationId);

  if (!ownerId) {
    throw new Error('This chat has no owner.');
  }

  return ownerId;
}

export const projectAccess: ProjectAccess = {
  trash: async (conversationId, id) => {
    const ownerId = await owner(conversationId);

    const project = (await listProjects(ownerId)).find(
      (candidate) => candidate.id === id
    );

    const chats = project && (await trashProject(ownerId, id));

    return project && chats && { chats: chats.length, project };
  },
  create: async (conversationId, name) =>
    createProject(await owner(conversationId), name),
  current: async (conversationId) => {
    const [row] = await db
      .select(fields)
      .from(schema.conversation)
      .innerJoin(table, eq(table.id, schema.conversation.projectId))
      .where(
        and(eq(schema.conversation.id, conversationId), isNull(table.deletedAt))
      );

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
  update: async (conversationId, id, change) =>
    updateProject(await owner(conversationId), id, change),
};
