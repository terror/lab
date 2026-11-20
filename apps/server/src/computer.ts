import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { ComputerDoc, networkModes } from '@lab/harness';
import { Hono } from 'hono';
import { z } from 'zod';

import { requireUser } from './auth';
import { harness } from './harness';
import { rateLimit } from './limits';
import {
  applyComputerNetwork,
  inspectComputer,
  resetComputer,
  stopComputer,
} from './sandbox';
import { validator } from './validator';

const settings = validator('json', z.object({ network: z.enum(networkModes) }));

async function networkMode(ownerId: string) {
  return (
    (await harness().snapshot(ComputerDoc, ownerId, BACKGROUND_CONTEXT))
      ?.network ?? 'full'
  );
}

async function status(ownerId: string) {
  return {
    ...(await inspectComputer(ownerId)),
    network: await networkMode(ownerId),
  };
}

const computer = new Hono()
  .use(requireUser)
  .use(rateLimit('computer'))
  .get('/', async (c) => c.json(await status(c.get('user').id)))
  .patch('/', settings, async (c) => {
    const { network } = c.req.valid('json');

    await harness().commit(async (tx) => {
      (await tx.doc(ComputerDoc, c.get('user').id, null)).network = network;
    }, BACKGROUND_CONTEXT);

    await applyComputerNetwork(c.get('user').id, network);

    return c.json(await status(c.get('user').id));
  })
  .post('/stop', async (c) => {
    await stopComputer(c.get('user').id);

    return c.body(null, 204);
  })
  .delete('/', async (c) => {
    await resetComputer(c.get('user').id);

    return c.body(null, 204);
  });

export default computer;
