import { createModels } from '@earendil-works/pi-ai/models';
import { vercelAIGatewayProvider } from '@earendil-works/pi-ai/providers/vercel-ai-gateway';
import { openHarness } from '@lab/harness';
import { fileURLToPath } from 'node:url';

const models = createModels();

models.setProvider(vercelAIGatewayProvider());

export const harness = await openHarness({
  model: {
    provider: 'vercel-ai-gateway',
    modelId: 'anthropic/claude-sonnet-5.5',
  },
  models,
  onReport: (report) => console.error(report),
  path:
    Bun.env.LAB_STORAGE_PATH ??
    fileURLToPath(new URL('../../../lab.sqlite', import.meta.url)),
});
