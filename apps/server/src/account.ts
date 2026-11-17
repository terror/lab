import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import type { ConversationId } from '@earendil-works/pi-durable';
import { schema } from '@lab/db';
import {
  ComputerDoc,
  MemoryDoc,
  PreferencesDoc,
  ProfileDoc,
  SkillsDoc,
} from '@lab/harness';
import { asc, eq } from 'drizzle-orm';

import { removeConnector } from './connections';
import { listConnectors } from './connectors';
import { db } from './db';
import { harness } from './harness';
import { flushHistory } from './history';
import { listProjects } from './project-access';
import { resetComputer } from './sandbox';
import { listTasks } from './schedule-access';

async function chats(ownerId: string) {
  await flushHistory();

  const [rows, messages] = await Promise.all([
    db
      .select({
        createdAt: schema.conversation.createdAt,
        deletedAt: schema.conversation.deletedAt,
        id: schema.conversation.id,
        projectId: schema.conversation.projectId,
        title: schema.conversation.title,
      })
      .from(schema.conversation)
      .where(eq(schema.conversation.ownerId, ownerId))
      .orderBy(asc(schema.conversation.createdAt)),
    db
      .select({
        conversationId: schema.messageText.conversationId,
        createdAt: schema.messageText.createdAt,
        role: schema.messageText.role,
        text: schema.messageText.text,
      })
      .from(schema.messageText)
      .where(eq(schema.messageText.ownerId, ownerId))
      .orderBy(asc(schema.messageText.entryId)),
  ]);

  return rows.map((chat) => ({
    ...chat,
    messages: messages.flatMap(({ conversationId, ...message }) =>
      conversationId === chat.id ? [message] : []
    ),
  }));
}

async function settings(ownerId: string) {
  const [computer, memory, preferences, profile, skills] = await Promise.all([
    harness.snapshot(ComputerDoc, ownerId, BACKGROUND_CONTEXT),
    harness.snapshot(MemoryDoc, ownerId, BACKGROUND_CONTEXT),
    harness.snapshot(PreferencesDoc, ownerId, BACKGROUND_CONTEXT),
    harness.snapshot(ProfileDoc, ownerId, BACKGROUND_CONTEXT),
    harness.snapshot(SkillsDoc, ownerId, BACKGROUND_CONTEXT),
  ]);

  return { computer, memory, preferences, profile, skills };
}

export async function exportAccount(user: {
  createdAt: Date;
  email: string;
  id: string;
  name: string;
}) {
  const [connectors, library, projects, schedules] = await Promise.all([
    listConnectors(user.id),
    db
      .select({
        createdAt: schema.libraryItem.createdAt,
        kind: schema.libraryItem.kind,
        name: schema.libraryItem.name,
      })
      .from(schema.libraryItem)
      .where(eq(schema.libraryItem.ownerId, user.id)),
    listProjects(user.id),
    listTasks(user.id),
  ]);

  return {
    account: { createdAt: user.createdAt, email: user.email, name: user.name },
    chats: await chats(user.id),
    connectors: connectors.connectors.map(({ enabled, name, url }) => ({
      enabled,
      name,
      url,
    })),
    exportedAt: new Date(),
    library,
    projects,
    schedules,
    ...(await settings(user.id)),
  };
}

export async function deleteAccount(ownerId: string) {
  const [conversations, connectors] = await Promise.all([
    db
      .select({ id: schema.conversation.id })
      .from(schema.conversation)
      .where(eq(schema.conversation.ownerId, ownerId)),
    db
      .select({ id: schema.connector.id })
      .from(schema.connector)
      .where(eq(schema.connector.ownerId, ownerId)),
  ]);

  for (const { id } of conversations) {
    await (
      await harness.conversation(id as ConversationId, BACKGROUND_CONTEXT)
    )?.abort(BACKGROUND_CONTEXT);
  }

  for (const { id } of connectors) {
    await removeConnector(id);
  }

  await resetComputer(ownerId).catch(() => undefined);

  await harness.commit(async (tx) => {
    await tx.retireDoc(ComputerDoc, ownerId);
    await tx.retireDoc(MemoryDoc, ownerId);
    await tx.retireDoc(PreferencesDoc, ownerId);
    await tx.retireDoc(ProfileDoc, ownerId);
    await tx.retireDoc(SkillsDoc, ownerId);
  }, BACKGROUND_CONTEXT);

  await db.transaction(async (tx) => {
    if (conversations.length > 0) {
      await tx
        .insert(schema.conversationDeletion)
        .values(conversations.map(({ id }) => ({ id, ownerId: null })))
        .onConflictDoNothing();
    }

    await tx.delete(schema.user).where(eq(schema.user.id, ownerId));
  });
}
