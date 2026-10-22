import { createRegistry } from '@earendil-works/pi-durable';
import { GATEWAY_PROVIDER, gatewayModels } from 'durable-harness/pi-durable';

import { lab } from './extensions/lab';

export const models = gatewayModels();
export const registry = createRegistry();

registry.install(lab);

export const agent = {
  model: {
    provider: GATEWAY_PROVIDER,
    modelId: Bun.env.LAB_MODEL ?? 'anthropic/claude-sonnet-5.5',
  },
};
