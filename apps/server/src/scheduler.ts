import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import type { ConversationId } from '@earendil-works/pi-durable';
import { schema } from '@lab/db';
import { ScheduledChatsDoc, TitleDoc } from '@lab/harness';
import { and, eq, lte } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';

import { db } from './db';
import { found } from './found';
import { harness } from './harness';
import { submitMessage } from './messages';
import { defaultModel, modelChange } from './models';
import { policy } from './policy';
import { nextRun, toTask } from './schedule-access';

const table = schema.scheduledTask;

type Row = typeof table.$inferSelect;

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const POLL_MS = 30_000;

let pendingAdmissions = Promise.resolve();

function admit<T>(run: () => Promise<T>) {
  const result = pendingAdmissions.then(run);

  pendingAdmissions = result.then(
    () => undefined,
    () => undefined
  );

  return result;
}

async function scheduledChat(row: Row) {
  const known = (
    await harness.snapshot(ScheduledChatsDoc, row.ownerId, BACKGROUND_CONTEXT)
  )?.[String(row.id)];

  if (known !== undefined) {
    const [deleted] = await db
      .select({ id: schema.conversationDeletion.id })
      .from(schema.conversationDeletion)
      .where(eq(schema.conversationDeletion.id, known));

    const conversation =
      !deleted && (await harness.conversation(known, BACKGROUND_CONTEXT));

    if (conversation) {
      return conversation;
    }
  }

  const model = await defaultModel();

  if (!model) {
    throw new HTTPException(400, {
      message: 'Add a provider in settings to start chatting',
    });
  }

  return harness.createConversation(
    {
      agent: modelChange(model, undefined),
      init: async (tx, id) => {
        (await tx.doc(TitleDoc, id)).title = row.title;
        (await tx.doc(ScheduledChatsDoc, row.ownerId, null))[String(row.id)] =
          id;
      },
      ownership: { kind: 'ownerless' },
    },
    BACKGROUND_CONTEXT
  );
}

async function conversationFor(row: Row, tx: Transaction) {
  const [chat] =
    row.conversationId === null
      ? []
      : await tx
          .select({
            deletedAt: schema.conversation.deletedAt,
            id: schema.conversation.id,
          })
          .from(schema.conversation)
          .where(eq(schema.conversation.id, row.conversationId));

  if (chat?.deletedAt) {
    return undefined;
  }

  const conversation =
    chat &&
    (await harness.conversation(chat.id as ConversationId, BACKGROUND_CONTEXT));

  if (conversation) {
    return conversation;
  }

  const created = await scheduledChat(row);

  await db
    .insert(schema.conversation)
    .values({ id: created.id, ownerId: row.ownerId, title: row.title })
    .onConflictDoNothing();

  const [registered] = await tx
    .select({ deletedAt: schema.conversation.deletedAt })
    .from(schema.conversation)
    .where(eq(schema.conversation.id, created.id));

  return registered?.deletedAt ? undefined : created;
}

async function submitTask(row: Row, requestId: string, tx: Transaction) {
  const conversation = await conversationFor(row, tx);

  if (!conversation) {
    return undefined;
  }

  const submitted = await harness.commit(
    (transaction) =>
      transaction.submissionByRequest(conversation.id, requestId),
    BACKGROUND_CONTEXT
  );

  if (!submitted) {
    await submitMessage(conversation, {
      attachments: [],
      content: row.prompt,
      requestId,
    });
  }

  return conversation.id;
}

export function runTask(ownerId: string, id: number) {
  return admit(() =>
    db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(table)
        .where(and(eq(table.id, id), eq(table.ownerId, ownerId)))
        .for('update');

      const conversationId = await submitTask(
        found(row, 'Scheduled task not found'),
        crypto.randomUUID(),
        tx
      );

      if (conversationId === undefined) {
        throw new HTTPException(409, {
          message: 'This task’s chat is in the Trash',
        });
      }

      const [updated] = await tx
        .update(table)
        .set({ conversationId, lastRunAt: new Date() })
        .where(eq(table.id, id))
        .returning();

      return toTask(found(updated, 'Scheduled task not found'));
    })
  );
}

export async function runDueTasks(now = new Date()) {
  const due = and(eq(table.enabled, true), lte(table.nextRunAt, now));

  const rows = await db.select({ id: table.id }).from(table).where(due);

  for (const { id } of rows) {
    await admit(() =>
      db.transaction(async (tx) => {
        const [row] = await tx
          .select()
          .from(table)
          .where(and(eq(table.id, id), due))
          .for('update', { skipLocked: true });

        if (!row?.nextRunAt || !(await policy(row.ownerId, tx)).active) {
          return;
        }

        const requestId = `schedule:${id}:${row.nextRunAt.toISOString()}`;

        const conversationId = await submitTask(row, requestId, tx);

        await tx
          .update(table)
          .set({
            nextRunAt: nextRun(row.cron, row.timezone, now),
            ...(conversationId !== undefined && {
              conversationId,
              lastRunAt: now,
            }),
          })
          .where(eq(table.id, id));
      })
    ).catch(console.error);
  }
}

export function startScheduler() {
  let pending: Promise<void> | undefined;

  function poll() {
    pending ??= runDueTasks()
      .catch(console.error)
      .finally(() => {
        pending = undefined;
      });
  }

  poll();

  const timer = setInterval(poll, POLL_MS);

  return async () => {
    clearInterval(timer);
    await pending;
    await pendingAdmissions;
  };
}
