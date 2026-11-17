import { schema } from '@lab/db';
import type { ProjectAccess } from '@lab/harness';
import { and, asc, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';

import { db } from './db';
import { requireOwner } from './records';

const PROJECT_LIMIT = 100;

export const projectLimitMessage = `You can have up to ${PROJECT_LIMIT} projects`;

const table = schema.project;

const fields = {
  id: table.id,
  instructions: table.instructions,
  name: table.name,
};

export type Project = { id: number; instructions: string; name: string };

export type ProjectChange = { instructions?: string; name?: string };

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

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

async function hasRoom(tx: Transaction, ownerId: string) {
  await tx
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.id, ownerId))
    .for('update');

  const [{ count } = { count: 0 }] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(table)
    .where(live(ownerId));

  return count < PROJECT_LIMIT;
}

export async function createProject(
  ownerId: string,
  name: string
): Promise<Project | undefined> {
  return db.transaction(async (tx) => {
    if (!(await hasRoom(tx, ownerId))) {
      return undefined;
    }

    const [row] = await tx
      .insert(table)
      .values({ name, ownerId })
      .returning(fields);

    return row;
  });
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

    if (!(await hasRoom(tx, ownerId))) {
      throw new HTTPException(400, { message: projectLimitMessage });
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

export const projectAccess: ProjectAccess = {
  trash: async (conversationId, id) => {
    const ownerId = await requireOwner(conversationId);

    const project = (await listProjects(ownerId)).find(
      (candidate) => candidate.id === id
    );

    const chats = await db
      .select({ id: schema.conversation.id })
      .from(schema.conversation)
      .where(
        and(
          eq(schema.conversation.projectId, id),
          isNull(schema.conversation.deletedAt)
        )
      );

    const { moveToTrash } = await import('./trash');

    const trashed =
      project &&
      (await moveToTrash('project', ownerId, id, { running: conversationId }));

    return trashed ? { chats: chats.length, project } : undefined;
  },
  create: async (conversationId, name) =>
    createProject(await requireOwner(conversationId), name),
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
  list: async (conversationId) =>
    listProjects(await requireOwner(conversationId)),
  move: async (conversationId, chatId, projectId) => {
    const ownerId = await requireOwner(conversationId);

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
    updateProject(await requireOwner(conversationId), id, change),
};
