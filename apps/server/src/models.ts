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
  ['amazon', 'Amazon'],
  ['anthropic', 'Anthropic'],
  ['bytedance', 'ByteDance'],
  ['cohere', 'Cohere'],
  ['deepseek', 'DeepSeek'],
  ['google', 'Google'],
  ['inclusionai', 'inclusionAI'],
  ['meta', 'Meta'],
  ['minimax', 'MiniMax'],
  ['mistral', 'Mistral'],
  ['moonshotai', 'Moonshot AI'],
  ['nvidia', 'NVIDIA'],
  ['openai', 'OpenAI'],
  ['stepfun', 'StepFun'],
  ['tencent', 'Tencent'],
  ['xai', 'xAI'],
  ['xiaomi', 'Xiaomi'],
  ['zai', 'Z.ai'],
]);

export const models = createModels();

models.setProvider(vercelAIGatewayProvider());

function vendor(id: string) {
  const prefix = id.split('/')[0] ?? id;

  return vendors.get(prefix) ?? prefix;
}

const chatModels = models
  .getModels('vercel-ai-gateway')
  .toSorted((a, b) => vendor(a.id).localeCompare(vendor(b.id)));

const fallback = chatModels.find(({ id }) => id === env.LAB_DEFAULT_MODEL);

if (!fallback) {
  throw new Error(
    `Unknown model \`${env.LAB_DEFAULT_MODEL}\` in \`LAB_DEFAULT_MODEL\``
  );
}

export const defaultModel = {
  provider: fallback.provider,
  modelId: fallback.id,
};

export function listModels() {
  return chatModels.map((model) => ({
    contextWindow: model.contextWindow,
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
