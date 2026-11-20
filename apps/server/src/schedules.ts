import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { schema } from '@lab/db';
import { ProfileDoc } from '@lab/harness';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

import { requireUser } from './auth';
import { db } from './db';
import { found } from './found';
import { harness } from './harness';
import { rateLimit } from './limits';
import { running } from './listing';
import {
  deleteTask,
  knownTimezone,
  listTasks,
  toTask,
  updateTask,
} from './schedule-access';
import { runTask } from './scheduler';
import { idParam, validator } from './validator';

const table = schema.scheduledTask;

const change = validator('json', z.object({ enabled: z.boolean() }));

const timezone = validator(
  'json',
  z.object({
    timezone: z
      .string()
      .min(1)
      .max(64)
      .refine(knownTimezone, 'Unknown timezone'),
  })
);

const MISSING = 'Scheduled task not found';

const schedules = new Hono()
  .use(requireUser)
  .get('/', async (c) => {
    const [tasks, busy] = await Promise.all([
      listTasks(c.get('user').id),
      running(),
    ]);

    return c.json({
      tasks: tasks.map((task) => ({
        ...task,
        running: task.conversationId !== null && busy.has(task.conversationId),
      })),
    });
  })
  .put('/timezone', timezone, async (c) => {
    await harness.commit(async (tx) => {
      (await tx.doc(ProfileDoc, c.get('user').id, null)).timezone =
        c.req.valid('json').timezone;
    }, BACKGROUND_CONTEXT);

    return c.body(null, 204);
  })
  .patch('/:id', idParam, change, async (c) => {
    const result = await updateTask(
      c.get('user').id,
      c.req.valid('param').id,
      c.req.valid('json')
    );

    if (result.kind === 'invalid') {
      throw new HTTPException(400, { message: result.message });
    }

    return c.json({
      task: found(result.kind === 'updated' ? result.task : undefined, MISSING),
    });
  })
  .post('/:id/run', rateLimit('messages'), idParam, async (c) => {
    const [row] = await db
      .select()
      .from(table)
      .where(
        and(
          eq(table.id, c.req.valid('param').id),
          eq(table.ownerId, c.get('user').id)
        )
      );

    if (!(await runTask(found(row, MISSING)))) {
      throw new HTTPException(409, {
        message: 'This task’s chat is in the Trash',
      });
    }

    const [updated] = await db
      .update(table)
      .set({ lastRunAt: new Date() })
      .where(eq(table.id, c.req.valid('param').id))
      .returning();

    return c.json({ task: found(updated && toTask(updated), MISSING) });
  })
  .delete('/:id', idParam, async (c) => {
    found(await deleteTask(c.get('user').id, c.req.valid('param').id), MISSING);

    return c.body(null, 204);
  });

export default schedules;
