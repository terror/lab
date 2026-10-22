import { createRegistry } from '@earendil-works/pi-durable';
import { GATEWAY_PROVIDER, gatewayModels } from 'durable-harness/pi-durable';

import { config } from './config';
import { lab } from './extensions/lab';

export type AgentConfiguration = {
  model: {
    provider: string;
    modelId: string;
  };
};

export const models = gatewayModels();
export const registry = createRegistry();

registry.install(lab);

export const agent = {
  model: {
    provider: GATEWAY_PROVIDER,
    modelId: config.modelId,
  },
} satisfies AgentConfiguration;
