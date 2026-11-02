import { Agent } from '@lab/framework';
import { VercelGateway } from '@lab/gateway-vercel';
import { PiHarness } from '@lab/harness-pi';
import { LocalStorage } from '@lab/storage-workflow';
import { PiHttpTransport } from '@lab/transport-pi-http';
import { fileURLToPath } from 'node:url';

import { lab } from './extensions/lab';

const gateway = new VercelGateway();

const harness = new PiHarness({
  agent: {
    model: gateway.model(Bun.env.LAB_MODEL ?? 'anthropic/claude-sonnet-5.5'),
  },
  extensions: [lab],
  gateway,
  storage: new LocalStorage({
    recoverActiveRuns: false,
    dataDir:
      Bun.env.WORKFLOW_LOCAL_DATA_DIR ??
      fileURLToPath(new URL('../../../.workflow-data', import.meta.url)),
  }),
});

export const agent = new Agent(harness);

export const transport = new PiHttpTransport(harness, { authorize: 'public' });
