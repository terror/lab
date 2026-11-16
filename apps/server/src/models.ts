import type { ModelThinkingLevel } from '@earendil-works/pi-ai';
import {
  clampThinkingLevel,
  createModels,
  getSupportedThinkingLevels,
} from '@earendil-works/pi-ai/models';
import { vercelAIGatewayProvider } from '@earendil-works/pi-ai/providers/vercel-ai-gateway';
import { HTTPException } from 'hono/http-exception';

import { env } from './env';

const vendors = new Map([
  ['alibaba', 'Alibaba'],
  ['anthropic', 'Anthropic'],
  ['deepseek', 'DeepSeek'],
  ['google', 'Google'],
  ['meta', 'Meta'],
  ['mistral', 'Mistral'],
  ['moonshotai', 'Moonshot AI'],
  ['openai', 'OpenAI'],
  ['xai', 'xAI'],
]);

export const models = createModels();

models.setProvider(vercelAIGatewayProvider());

const chatModels = env.LAB_MODELS.map((id) => {
  const model = models.getModel('vercel-ai-gateway', id);

  if (!model) {
    throw new Error(`Unknown model \`${id}\` in \`LAB_MODELS\``);
  }

  return model;
});

const [first] = chatModels;

if (!first) {
  throw new Error('`LAB_MODELS` must name at least one model');
}

export const defaultModel = { provider: first.provider, modelId: first.id };

function vendor(id: string) {
  const prefix = id.split('/')[0] ?? id;

  return vendors.get(prefix) ?? prefix;
}

export function listModels() {
  return chatModels.map((model) => ({
    contextWindow: model.contextWindow,
    cost: { input: model.cost.input, output: model.cost.output },
    id: model.id,
    images: model.input.includes('image'),
    maxTokens: model.maxTokens,
    name: model.name,
    provider: vendor(model.id),
    reasoning: model.reasoning,
    thinkingLevels: getSupportedThinkingLevels(model),
  }));
}

export function acceptsImages(id: string | undefined) {
  const model = chatModels.find((candidate) => candidate.id === id);

  return model?.input.includes('image') ?? false;
}

export function modelChange(id: string, thinkingLevel?: ModelThinkingLevel) {
  const model = chatModels.find((candidate) => candidate.id === id);

  if (!model) {
    throw new HTTPException(400, { message: 'Unknown model' });
  }

  return {
    model: { provider: model.provider, modelId: model.id },
    thinkingLevel:
      thinkingLevel === undefined
        ? undefined
        : clampThinkingLevel(model, thinkingLevel),
  };
}
