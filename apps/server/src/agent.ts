import { type AgentChange, GATEWAY_PROVIDER } from '@lab/framework';

export const agent = {
  model: {
    provider: GATEWAY_PROVIDER,
    modelId: Bun.env.LAB_MODEL ?? 'anthropic/claude-sonnet-5.5',
  },
} satisfies AgentChange;
