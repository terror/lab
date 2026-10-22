import { recoverSessions, registerQueue } from 'durable-harness';

import app from './app';
import { world } from './runtime';

registerQueue(world);

await world.start?.();
await recoverSessions(world);

export default {
  hostname: Bun.env.LAB_HOST ?? '127.0.0.1',
  idleTimeout: 60,
  fetch: app.fetch,
};
