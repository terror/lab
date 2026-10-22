import type { Model } from '@earendil-works/pi-ai';
import { vercelAIGatewayProvider } from '@earendil-works/pi-ai/providers/vercel-ai-gateway';
import { createRegistry } from '@earendil-works/pi-durable';
import { GATEWAY_PROVIDER, gatewayModels } from 'durable-harness/pi-durable';

import { config } from '../config';
import { lab } from './extensions/lab';

export type AgentConfiguration = {
  model: {
    provider: string;
    modelId: string;
  };
};

const extraModels = [
  {
    id: 'reflection/beam-free',
    name: 'Beam 1.0 (Free)',
    api: 'anthropic-messages',
    provider: GATEWAY_PROVIDER,
    baseUrl: 'https://ai-gateway.vercel.sh',
    reasoning: true,
    input: ['text'],
    contextWindow: 1_000_000,
    maxTokens: 131_072,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    compat: { allowEmptySignature: true },
  },
] satisfies Model<'anthropic-messages'>[];

const gateway = vercelAIGatewayProvider();
const extraIds = new Set(extraModels.map((model) => model.id));

export const models = gatewayModels();

models.setProvider({
  ...gateway,
  getModels: () => [
    ...gateway.getModels().filter((model) => !extraIds.has(model.id)),
    ...extraModels,
  ],
  getAllModels: () => [
    ...(gateway.getAllModels?.() ?? gateway.getModels()).filter(
      (model) => !extraIds.has(model.id)
    ),
    ...extraModels,
  ],
});

export const registry = createRegistry();

registry.install(lab);

export const agent = {
  model: {
    provider: GATEWAY_PROVIDER,
    modelId: config.modelId,
  },
} satisfies AgentConfiguration;
