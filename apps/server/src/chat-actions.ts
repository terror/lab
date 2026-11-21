import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import type { Conversation, ConversationId } from '@earendil-works/pi-durable';
import { schema } from '@lab/db';
import { type ChatSummary, TitleDoc } from '@lab/harness';
import { eq, sql } from 'drizzle-orm';
import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';

import type { User } from './auth';
import type { Parent } from './branches';
import { db } from './db';
import { harness } from './harness';
import { submitMessage } from './messages';
import type { modelChange } from './models';
import { moveChat } from './project-access';
import { flushProjections } from './projections';
import { liveChat } from './records';

const table = schema.conversation;

export const ownedChat = createMiddleware<{
  Variables: {
    conversation: Conversation;
    pinned: boolean;
    projectId: number | null;
    user: User;
  };
}>(async (c, next) => {
  const [record] = await db
    .select({
      id: table.id,
      pinnedAt: table.pinnedAt,
      projectId: table.projectId,
    })
    .from(table)
    .where(liveChat(c.get('user').id, Number(c.req.param('id'))));

  const conversation =
    record &&
    (await harness.conversation(
      record.id as ConversationId,
      BACKGROUND_CONTEXT
    ));

  if (!conversation) {
    throw new HTTPException(404, { message: 'Conversation not found' });
  }

  c.set('conversation', conversation);
  c.set('pinned', record.pinnedAt !== null);
  c.set('projectId', record.projectId);

  await next();
});

export const ownedSubagent = createMiddleware<{
  Variables: { conversation: Conversation; subagent: Conversation };
}>(async (c, next) => {
  const id = Number(c.req.param('agentId')) as ConversationId;

  const record = await harness.commit(
    (tx) => tx.conversation(id),
    BACKGROUND_CONTEXT
  );

  const subagent =
    record?.owner?.conversationId === c.get('conversation').id &&
    (await harness.conversation(id, BACKGROUND_CONTEXT));

  if (!subagent) {
    throw new HTTPException(404, { message: 'Subagent not found' });
  }

  c.set('subagent', subagent);

  await next();
});

export async function chatSummary(
  ownerId: string,
  id: number
): Promise<ChatSummary | undefined> {
  const [row] = await db
    .select({ id: table.id, pinnedAt: table.pinnedAt, title: table.title })
    .from(table)
    .where(liveChat(ownerId, id));

  return row && { id: row.id, pinned: row.pinnedAt !== null, title: row.title };
}

export async function renameChat(
  ownerId: string,
  id: number,
  title: string
): Promise<ChatSummary | undefined> {
  const chat = await chatSummary(ownerId, id);

  const conversation =
    chat &&
    (await harness.conversation(id as ConversationId, BACKGROUND_CONTEXT));

  if (!chat || !conversation) {
    return undefined;
  }

  await conversation.commit(async (tx) => {
    (await tx.doc(TitleDoc, conversation.id)).title = title;
  }, BACKGROUND_CONTEXT);

  return { ...chat, title };
}

export async function pinChat(
  ownerId: string,
  id: number,
  pinned: boolean
): Promise<ChatSummary | undefined> {
  const [row] = await db
    .update(table)
    .set({ pinnedAt: pinned ? new Date() : null })
    .where(liveChat(ownerId, id))
    .returning({ id: table.id, title: table.title });

  return row && { ...row, pinned };
}

export async function readChat(ownerId: string, id: number) {
  await flushProjections();

  await db
    .update(table)
    .set({ readAt: sql`${table.lastMessageAt}` })
    .where(liveChat(ownerId, id));
}

export async function startChat(
  ownerId: string,
  conversation: Conversation,
  {
    parent,
    projectId,
    title,
  }: { parent?: Parent; projectId?: number; title?: string },
  start: () => Promise<unknown>
) {
  await db.insert(schema.conversation).values({
    id: conversation.id,
    ownerId,
    parentEntryId: parent?.entryId,
    parentId: parent?.conversationId,
    title,
  });

  try {
    if (
      projectId !== undefined &&
      !(await moveChat(ownerId, conversation.id, projectId))
    ) {
      throw new HTTPException(404, { message: 'Project not found' });
    }

    if (title) {
      await conversation.commit(async (tx) => {
        (await tx.doc(TitleDoc, conversation.id)).title = title;
      }, BACKGROUND_CONTEXT);
    }

    await start();
  } catch (error) {
    await db.transaction(async (tx) => {
      await tx
        .delete(schema.conversation)
        .where(eq(schema.conversation.id, conversation.id));

      await tx
        .insert(schema.conversationDeletion)
        .values({ id: conversation.id })
        .onConflictDoNothing();
    });

    throw error;
  }

  return conversation.id;
}

export async function createChat(
  ownerId: string,
  {
    change,
    draft,
    projectId,
    title,
  }: {
    change: ReturnType<typeof modelChange>;
    draft: Parameters<typeof submitMessage>[1];
    projectId?: number;
    title?: string;
  }
) {
  const conversation = await harness.createConversation(
    { agent: change, ownership: { kind: 'ownerless' } },
    BACKGROUND_CONTEXT
  );

  return startChat(ownerId, conversation, { projectId, title }, () =>
    submitMessage(conversation, draft)
  );
}
