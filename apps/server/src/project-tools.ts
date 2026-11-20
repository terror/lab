import { schema } from '@lab/db';
import type { ProjectAccess } from '@lab/harness';
import { and, eq, isNull } from 'drizzle-orm';

import { db } from './db';
import {
  createProject,
  listProjects,
  moveChat,
  updateProject,
} from './project-access';
import { requireOwner } from './records';
import { moveToTrash } from './trash-items';

const table = schema.project;

const fields = {
  id: table.id,
  instructions: table.instructions,
  name: table.name,
};

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
