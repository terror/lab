import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';

import app from './app';
import { harness } from './harness';

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void harness.close(BACKGROUND_CONTEXT).finally(() => process.exit());
  });
}

export default {
  hostname: Bun.env.LAB_HOST ?? '127.0.0.1',
  fetch: app.fetch,
};
