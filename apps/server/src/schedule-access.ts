import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { schema } from '@lab/db';
import {
  ScheduledChatsDoc,
  type ScheduleAccess,
  type ScheduleUpdate,
  type ScheduledTask,
} from '@lab/harness';
import { Cron } from 'croner';
import { and, asc, eq, getTableColumns, isNull } from 'drizzle-orm';

import { db } from './db';
import { harness } from './harness';
import { requireOwner } from './records';

const table = schema.scheduledTask;

type Row = typeof table.$inferSelect;

export function knownTimezone(timezone: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format();

    return true;
  } catch {
    return false;
  }
}

function cronError(cron: string, timezone: string) {
  if (!knownTimezone(timezone)) {
    return `Unknown timezone: ${timezone}`;
  }

  try {
    return new Cron(cron, { paused: true, timezone }).nextRun()
      ? undefined
      : 'Invalid schedule: it never runs.';
  } catch (error) {
    return `Invalid schedule: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export function nextRun(cron: string, timezone: string, from: Date) {
  return new Cron(cron, { paused: true, timezone }).nextRun(from) ?? null;
}

export function toTask(row: Row): ScheduledTask {
  return {
    conversationId: row.conversationId,
    cron: row.cron,
    description: row.description,
    enabled: row.enabled,
    id: row.id,
    lastRunAt: row.lastRunAt?.toISOString() ?? null,
    nextRunAt: row.nextRunAt?.toISOString() ?? null,
    prompt: row.prompt,
    timezone: row.timezone,
    title: row.title,
  };
}

export async function listTasks(ownerId: string) {
  const rows = await db
    .select({
      ...getTableColumns(table),
      conversationId: schema.conversation.id,
    })
    .from(table)
    .leftJoin(
      schema.conversation,
      and(
        eq(schema.conversation.id, table.conversationId),
        isNull(schema.conversation.deletedAt)
      )
    )
    .where(eq(table.ownerId, ownerId))
    .orderBy(asc(table.createdAt));

  return rows.map(toTask);
}

export async function updateTask(
  ownerId: string,
  id: number,
  change: Parameters<ScheduleAccess['update']>[2]
): Promise<ScheduleUpdate> {
  const [current] = await db
    .select()
    .from(table)
    .where(and(eq(table.id, id), eq(table.ownerId, ownerId)));

  if (!current) {
    return { kind: 'missing' };
  }

  const next = { ...current, ...change };

  const invalid = cronError(next.cron, next.timezone);

  if (invalid) {
    return { kind: 'invalid', message: invalid };
  }

  const [row] = await db
    .update(table)
    .set({
      ...change,
      nextRunAt: next.enabled
        ? nextRun(next.cron, next.timezone, new Date())
        : null,
    })
    .where(eq(table.id, id))
    .returning();

  return row ? { kind: 'updated', task: toTask(row) } : { kind: 'missing' };
}

export async function deleteTask(ownerId: string, id: number) {
  const [row] = await db
    .delete(table)
    .where(and(eq(table.id, id), eq(table.ownerId, ownerId)))
    .returning();

  if (row) {
    await harness().commit(async (tx) => {
      delete (await tx.doc(ScheduledChatsDoc, ownerId, null))[String(id)];
    }, BACKGROUND_CONTEXT);
  }

  return row && toTask(row);
}

export const scheduleAccess: ScheduleAccess = {
  create: async ({ conversationId, taskId }, input) => {
    const ownerId = await requireOwner(conversationId);

    const creation = schema.scheduledTaskCreation;

    return db.transaction(async (tx) => {
      const [created] = await tx
        .insert(creation)
        .values({ ownerId, taskId })
        .onConflictDoNothing()
        .returning();

      if (!created) {
        const [row] = await tx
          .select(getTableColumns(table))
          .from(creation)
          .innerJoin(table, eq(table.id, creation.scheduledTaskId))
          .where(
            and(eq(creation.taskId, taskId), eq(creation.ownerId, ownerId))
          );

        return row && toTask(row);
      }

      const [row] = await tx
        .insert(table)
        .values({
          ...input,
          conversationId,
          nextRunAt: nextRun(input.cron, input.timezone, new Date()),
          ownerId,
        })
        .returning();

      if (!row) {
        throw new Error('Unable to schedule the task.');
      }

      await tx
        .update(creation)
        .set({ scheduledTaskId: row.id })
        .where(and(eq(creation.taskId, taskId), eq(creation.ownerId, ownerId)));

      return toTask(row);
    });
  },
  delete: async (conversationId, id) =>
    deleteTask(await requireOwner(conversationId), id),
  invalid: cronError,
  list: async (conversationId) => listTasks(await requireOwner(conversationId)),
  update: async (conversationId, id, change) =>
    updateTask(await requireOwner(conversationId), id, change),
};
