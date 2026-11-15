import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';

import app from './app';
import { env } from './env';
import { harness } from './harness';

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void harness.close(BACKGROUND_CONTEXT).finally(() => process.exit());
  });
}

export default {
  hostname: env.LAB_HOST,
  fetch: app.fetch,
};
