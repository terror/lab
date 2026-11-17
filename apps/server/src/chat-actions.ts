import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import type { ConversationId } from '@earendil-works/pi-durable';
import { schema } from '@lab/db';
import { type ChatSummary, TitleDoc } from '@lab/harness';
import { and, eq, isNull } from 'drizzle-orm';

import { db } from './db';
import { harness } from './harness';

const table = schema.conversation;

function live(ownerId: string, id: number) {
  return and(
    eq(table.id, id),
    eq(table.ownerId, ownerId),
    isNull(table.deletedAt)
  );
}

export async function chatSummary(
  ownerId: string,
  id: number
): Promise<ChatSummary | undefined> {
  const [row] = await db
    .select({ id: table.id, pinnedAt: table.pinnedAt, title: table.title })
    .from(table)
    .where(live(ownerId, id));

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
    .where(live(ownerId, id))
    .returning({ id: table.id, title: table.title });

  return row && { ...row, pinned };
}
