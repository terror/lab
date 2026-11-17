import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import type { ConversationId } from '@earendil-works/pi-durable';
import { schema } from '@lab/db';
import { ProfileDoc } from '@lab/harness';
import { and, eq, isNull, lte } from 'drizzle-orm';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

import { requireUser } from './auth';
import { createChat } from './conversations';
import { db } from './db';
import { harness } from './harness';
import { submitMessage } from './messages';
import { defaultModel, modelChange } from './models';
import {
  deleteTask,
  listTasks,
  nextRun,
  toTask,
  updateTask,
} from './schedule-access';
import { validator } from './validator';

const table = schema.scheduledTask;

type Row = typeof table.$inferSelect;

const POLL_MS = 30_000;

async function chatFor(row: Row) {
  if (!row.conversationId) {
    return undefined;
  }

  const [live] = await db
    .select({ id: schema.conversation.id })
    .from(schema.conversation)
    .where(
      and(
        eq(schema.conversation.id, row.conversationId),
        isNull(schema.conversation.deletedAt)
      )
    );

  return live
    ? harness.conversation(live.id as ConversationId, BACKGROUND_CONTEXT)
    : undefined;
}

async function run(row: Row) {
  const draft = { attachments: [], content: row.prompt };

  const conversation = await chatFor(row);

  if (conversation) {
    await submitMessage(conversation, draft);
    return;
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
    const claimed = await claim(row, now);

    if (claimed) {
      await run(claimed).catch(console.error);
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

const params = validator(
  'param',
  z.object({ id: z.coerce.number().int().positive() })
);

const change = validator('json', z.object({ enabled: z.boolean() }));

const timezone = validator(
  'json',
  z.object({ timezone: z.string().min(1).max(64) })
);

function found<T>(value: T | undefined) {
  if (value === undefined) {
    throw new HTTPException(404, { message: 'Scheduled task not found' });
  }

  return value;
}

const schedules = new Hono()
  .use(requireUser)
  .get('/', async (c) => c.json({ tasks: await listTasks(c.get('user').id) }))
  .put('/timezone', timezone, async (c) => {
    await harness.commit(async (tx) => {
      (await tx.doc(ProfileDoc)).timezone = c.req.valid('json').timezone;
    }, BACKGROUND_CONTEXT);

    return c.body(null, 204);
  })
  .patch('/:id', params, change, async (c) => {
    const result = await updateTask(
      c.get('user').id,
      c.req.valid('param').id,
      c.req.valid('json')
    );

    if (result.kind === 'invalid') {
      throw new HTTPException(400, { message: result.message });
    }

    return c.json({
      task: found(result.kind === 'updated' ? result.task : undefined),
    });
  })
  .post('/:id/run', params, async (c) => {
    const [row] = await db
      .select()
      .from(table)
      .where(
        and(
          eq(table.id, c.req.valid('param').id),
          eq(table.ownerId, c.get('user').id)
        )
      );

    await run(found(row));

    const [updated] = await db
      .update(table)
      .set({ lastRunAt: new Date() })
      .where(eq(table.id, c.req.valid('param').id))
      .returning();

    return c.json({ task: found(updated && toTask(updated)) });
  })
  .delete('/:id', params, async (c) => {
    found(await deleteTask(c.get('user').id, c.req.valid('param').id));

    return c.body(null, 204);
  });

export default schedules;
