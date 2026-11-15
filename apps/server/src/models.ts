import { createModels } from '@earendil-works/pi-ai/models';
import { vercelAIGatewayProvider } from '@earendil-works/pi-ai/providers/vercel-ai-gateway';
import type { ModelRef } from '@earendil-works/pi-durable';

import { env } from './env';

type ChatModel = ModelRef & { name: string };

export const models = createModels();

models.setProvider(vercelAIGatewayProvider());

export const chatModels = env.LAB_MODELS.map((id): ChatModel => {
  const model = models.getModel('vercel-ai-gateway', id);

  if (!model) {
    throw new Error(`Unknown model \`${id}\` in \`LAB_MODELS\``);
  }

  return { provider: model.provider, modelId: model.id, name: model.name };
});

const [first] = chatModels;

if (!first) {
  throw new Error('`LAB_MODELS` must name at least one model');
}

export const defaultModel = first;
