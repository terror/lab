import { schema } from '@lab/db';
import type {
  ScheduleAccess,
  ScheduleUpdate,
  ScheduledTask,
} from '@lab/harness';
import { Cron } from 'croner';
import { and, asc, eq } from 'drizzle-orm';

import { db } from './db';
import { conversationOwner } from './records';

const table = schema.scheduledTask;

type Row = typeof table.$inferSelect;

function knownTimezone(timezone: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format();

    return true;
  } catch {
    return false;
  }
}

export function cronError(cron: string, timezone: string) {
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
    .select()
    .from(table)
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

  return row && toTask(row);
}

async function owner(conversationId: number) {
  const ownerId = await conversationOwner(conversationId);

  if (!ownerId) {
    throw new Error('This chat has no owner.');
  }

  return ownerId;
}

export const scheduleAccess: ScheduleAccess = {
  create: async (conversationId, input) => {
    const ownerId = await owner(conversationId);

    const [row] = await db
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

    return toTask(row);
  },
  delete: async (conversationId, id) =>
    deleteTask(await owner(conversationId), id),
  invalid: cronError,
  list: async (conversationId) => listTasks(await owner(conversationId)),
  update: async (conversationId, id, change) =>
    updateTask(await owner(conversationId), id, change),
};
