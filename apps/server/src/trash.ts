import { trashKinds } from '@lab/harness';
import { Hono } from 'hono';
import { z } from 'zod';

import { requireUser } from './auth';
import { found } from './found';
import {
  emptyTrash,
  listTrash,
  purgeFromTrash,
  restoreFromTrash,
} from './trash-items';
import { positiveId, validator } from './validator';

const params = validator(
  'param',
  z.object({
    id: positiveId,
    kind: z.enum(trashKinds),
  })
);

const trash = new Hono()
  .use(requireUser)
  .get('/', async (c) =>
    c.json({
      items: await listTrash(c.get('user').id),
    })
  )
  .post('/:kind/:id/restore', params, async (c) => {
    const { id, kind } = c.req.valid('param');

    found(
      await restoreFromTrash(kind, c.get('user').id, id),
      'Not in the trash'
    );

    return c.body(null, 204);
  })
  .delete('/:kind/:id', params, async (c) => {
    const { id, kind } = c.req.valid('param');

    const chats = found(
      await purgeFromTrash(kind, c.get('user').id, id),
      'Not in the trash'
    );

    return c.json({ chats });
  })
  .delete('/', async (c) =>
    c.json({ chats: await emptyTrash(c.get('user').id) })
  );

export default trash;
