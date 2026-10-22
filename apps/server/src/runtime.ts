import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { Harness } from '@earendil-works/pi-durable';
import { createWorld } from '@workflow/world-local';
import { resumeWith } from 'durable-harness/pi-durable';
import { fileURLToPath } from 'node:url';

import { models, registry } from './agent';

export const world = createWorld({
  dataDir:
    Bun.env.WORKFLOW_LOCAL_DATA_DIR ??
    fileURLToPath(new URL('../../../.workflow-data', import.meta.url)),
  recoverActiveRuns: false,
});

export const open = resumeWith(
  (storage) => Harness.open(storage, { models, registry }, BACKGROUND_CONTEXT),
  { world }
);
