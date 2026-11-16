import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import type { ConversationId, Harness } from '@earendil-works/pi-durable';
import { schema } from '@lab/db';
import { TitleDoc, type Titles } from '@lab/harness';
import { eq, isNull } from 'drizzle-orm';

import { db } from './db';

export const titles: Titles = {
  get: async (id) => {
    const [row] = await db
      .select({ title: schema.conversation.title })
      .from(schema.conversation)
      .where(eq(schema.conversation.id, id));

    return row?.title ?? null;
  },
  set: async (id, title) => {
    await db
      .update(schema.conversation)
      .set({ title })
      .where(eq(schema.conversation.id, id));
  },
};

export async function backfillTitles(harness: Harness) {
  const rows = await db
    .select({ id: schema.conversation.id })
    .from(schema.conversation)
    .where(isNull(schema.conversation.title));

  for (const { id } of rows) {
    const doc = await harness.snapshot(
      TitleDoc,
      id as ConversationId,
      BACKGROUND_CONTEXT
    );

    if (doc?.title) {
      await titles.set(id as ConversationId, doc.title);
    }
  }
}
