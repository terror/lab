import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';

import app from './app';
import { db } from './db';
import { env } from './env';
import { harness } from './harness';
import { backfillAll } from './pipelines';

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void Promise.allSettled([
      harness.close(BACKGROUND_CONTEXT),
      db.$client.close(),
    ]).finally(() => process.exit());
  });
}

backfillAll();

export default {
  hostname: env.LAB_HOST,
  fetch: app.fetch,
};
