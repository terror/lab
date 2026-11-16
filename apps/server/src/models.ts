import type { Api, Model, ModelThinkingLevel } from '@earendil-works/pi-ai';
import {
  clampThinkingLevel,
  getSupportedThinkingLevels,
} from '@earendil-works/pi-ai/models';
import { builtinModels } from '@earendil-works/pi-ai/providers/all';
import { HTTPException } from 'hono/http-exception';

import { credentials } from './credentials';
import { env } from './env';

export const models = builtinModels({
  authContext: {
    env: async () => undefined,
    fileExists: async () => false,
  },
  credentials,
});

const unsupported = new Set([
  'amazon-bedrock',
  'azure',
  'cloudflare-ai-gateway',
  'cloudflare-workers-ai',
  'google-vertex',
]);

export function keyProviders() {
  return models
    .getProviders()
    .filter(({ auth, id }) => auth.apiKey && !unsupported.has(id))
    .toSorted((a, b) => a.name.localeCompare(b.name));
}

function providerName(id: string) {
  return models.getProvider(id)?.name ?? id;
}

const collator = new Intl.Collator('en', {
  numeric: true,
  sensitivity: 'base',
});

function owner(id: string) {
  return id.includes('/') ? (id.split('/')[0] ?? '') : '';
}

function family(name: string) {
  return name.replace(/\s*\(.*\)$/, '');
}

async function availableModels() {
  const available = await models.getAvailable();

  return available.toSorted(
    (a, b) =>
      collator.compare(providerName(a.provider), providerName(b.provider)) ||
      collator.compare(owner(a.id), owner(b.id)) ||
      collator.compare(family(b.name), family(a.name)) ||
      collator.compare(a.name, b.name)
  );
}

export async function defaultModel() {
  const available = await availableModels();

  return (
    available.find(({ id }) => id === env.LAB_DEFAULT_MODEL) ?? available[0]
  );
}

export async function listModels() {
  const available = await availableModels();

  return available.map((model) => ({
    id: model.id,
    name: model.name,
    provider: model.provider,
    providerName: providerName(model.provider),
    thinkingLevels: getSupportedThinkingLevels(model),
  }));
}

export async function findModel(provider: string, id: string) {
  const model = models.getModel(provider, id);

  if (!model || !(await models.checkAuth(provider))) {
    throw new HTTPException(400, { message: 'Unknown model' });
  }

  return model;
}

export function acceptsImages(model: Model<Api> | undefined) {
  return model?.input.includes('image') ?? false;
}

export function modelChange(
  model: Model<Api>,
  thinkingLevel?: ModelThinkingLevel
) {
  return {
    model: { provider: model.provider, modelId: model.id },
    thinkingLevel:
      thinkingLevel === undefined
        ? undefined
        : clampThinkingLevel(model, thinkingLevel),
  };
}
