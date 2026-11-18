import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import type { ConversationId } from '@earendil-works/pi-durable';
import { schema } from '@lab/db';
import { and, eq, lte } from 'drizzle-orm';

import { createChat } from './chat-actions';
import { db } from './db';
import { harness } from './harness';
import { submitMessage } from './messages';
import { defaultModel, modelChange } from './models';
import { policy } from './policy';
import { nextRun } from './schedule-access';

const table = schema.scheduledTask;

type Row = typeof table.$inferSelect;

const POLL_MS = 30_000;

export async function runTask(row: Row) {
  const draft = { attachments: [], content: row.prompt };

  const [chat] = row.conversationId
    ? await db
        .select({
          deletedAt: schema.conversation.deletedAt,
          id: schema.conversation.id,
        })
        .from(schema.conversation)
        .where(eq(schema.conversation.id, row.conversationId))
    : [];

  if (chat?.deletedAt) {
    return false;
  }

  const conversation =
    chat &&
    (await harness.conversation(chat.id as ConversationId, BACKGROUND_CONTEXT));

  if (conversation) {
    await submitMessage(conversation, draft);
    return true;
  }

  const model = await defaultModel();

  if (!model) {
    throw new Error('No model is available for scheduled tasks.');
  }

  const id = await createChat(row.ownerId, {
    change: modelChange(model, undefined),
    draft,
    title: row.title,
  });

  await db
    .update(table)
    .set({ conversationId: id })
    .where(eq(table.id, row.id));

  return true;
}

async function claim(row: Row, now: Date) {
  const [claimed] = await db
    .update(table)
    .set({
      lastRunAt: now,
      nextRunAt: nextRun(row.cron, row.timezone, now),
    })
    .where(
      and(
        eq(table.id, row.id),
        row.nextRunAt ? eq(table.nextRunAt, row.nextRunAt) : undefined
      )
    )
    .returning();

  return claimed;
}

export async function runDueTasks(now = new Date()) {
  const due = await db
    .select()
    .from(table)
    .where(and(eq(table.enabled, true), lte(table.nextRunAt, now)));

  for (const row of due) {
    if (!(await policy(row.ownerId)).active) {
      continue;
    }

    const claimed = await claim(row, now);

    if (claimed) {
      await runTask(claimed).catch(console.error);
    }
  }
}

export function startScheduler() {
  const timer = setInterval(() => {
    void runDueTasks().catch(console.error);
  }, POLL_MS);

  void runDueTasks().catch(console.error);

  return () => clearInterval(timer);
}
