import type { Gateway } from '@lab/harness';
import type { ModelRef } from '@lab/protocol';
import { GATEWAY_PROVIDER, gatewayModels } from 'durable-harness/pi-durable';

export type VercelGatewayOptions = NonNullable<
  Parameters<typeof gatewayModels>[0]
>;

export class VercelGateway implements Gateway<
  ReturnType<typeof gatewayModels>
> {
  readonly models: ReturnType<typeof gatewayModels>;

  constructor(options: VercelGatewayOptions = {}) {
    this.models = gatewayModels(options);
  }

  model(modelId: string): ModelRef {
    return { provider: GATEWAY_PROVIDER, modelId };
  }
}
