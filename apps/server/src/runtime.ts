import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { Harness } from '@earendil-works/pi-durable';
import { createWorld } from '@workflow/world-postgres';
import { resumeWith } from 'durable-harness/pi-durable';

import { models, registry } from './agent';
import { config } from './config';

const queueConcurrency = 50;

export const world = createWorld({
  connectionString: config.workflowURL,
  applicationManagedShutdown: true,
  queueConcurrency,
  maxPoolSize: queueConcurrency + 2,
});

export const open = resumeWith(
  (storage) => Harness.open(storage, { models, registry }, BACKGROUND_CONTEXT),
  { world }
);
