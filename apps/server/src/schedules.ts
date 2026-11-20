import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { ProfileDoc } from '@lab/harness';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

import { requireUser } from './auth';
import { found } from './found';
import { harness } from './harness';
import { rateLimit } from './limits';
import {
  deleteTask,
  knownTimezone,
  listTasks,
  updateTask,
} from './schedule-access';
import { runTask } from './scheduler';
import { idParam, validator } from './validator';

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
  .get('/', async (c) => c.json({ tasks: await listTasks(c.get('user').id) }))
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
  .post('/:id/run', rateLimit('messages'), idParam, async (c) =>
    c.json({
      task: await runTask(c.get('user').id, c.req.valid('param').id),
    })
  )
  .delete('/:id', idParam, async (c) => {
    found(await deleteTask(c.get('user').id, c.req.valid('param').id), MISSING);

    return c.body(null, 204);
  });

export default schedules;
