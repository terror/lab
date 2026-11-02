import { Agent } from '@lab/framework';
import { fileURLToPath } from 'node:url';

import { agent } from './agent';
import { lab } from './extensions/lab';

export const runtime = new Agent({
  agent,
  extensions: [lab],
  dataDir:
    Bun.env.WORKFLOW_LOCAL_DATA_DIR ??
    fileURLToPath(new URL('../../../.workflow-data', import.meta.url)),
});
