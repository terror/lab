import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { Harness } from '@earendil-works/pi-durable';
import { createWorld } from '@workflow/world-postgres';
import { resumeWith } from 'durable-harness/pi-durable';

import { models, registry } from './agent';
import { config } from './config';

export const world = createWorld({
  connectionString: config.workflowURL,
  applicationManagedShutdown: true,
  queueConcurrency: config.queueConcurrency,
  maxPoolSize: config.workflowPoolSize,
});

export const storage = { world, traceAudience: 'private' as const };

export const open = resumeWith(
  (storage) => Harness.open(storage, { models, registry }, BACKGROUND_CONTEXT),
  { world }
);
