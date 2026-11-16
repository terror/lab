import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';

import app from './app';
import { db } from './db';
import { env } from './env';
import { harness } from './harness';
import { backfillLibrary } from './library';
import { projectAll } from './projections';
import { backfillUsage } from './usage';

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void Promise.allSettled([
      harness.close(BACKGROUND_CONTEXT),
      db.$client.close(),
    ]).finally(() => process.exit());
  });
}

void projectAll().catch(console.error);
void backfillUsage().catch(console.error);
void backfillLibrary().catch(console.error);

export default {
  hostname: env.LAB_HOST,
  fetch: app.fetch,
};
