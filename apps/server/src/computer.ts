import { Hono } from 'hono';

import { requireUser } from './auth';
import { computerStatus, resetComputer, stopComputer } from './sandbox';

const computer = new Hono()
  .use(requireUser)
  .get('/', async (c) => c.json(await computerStatus(c.get('user').id)))
  .post('/stop', async (c) => {
    await stopComputer(c.get('user').id);

    return c.body(null, 204);
  })
  .delete('/', async (c) => {
    await resetComputer(c.get('user').id);

    return c.body(null, 204);
  });

export default computer;
