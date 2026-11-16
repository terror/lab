import type { InferResponseType } from 'hono/client';

import type { client } from '../src/lib/client';

type Catalog = InferResponseType<typeof client.models.$get, 200>;

type Model = Catalog['models'][number];

const levels: Model['thinkingLevels'] = [
  'off',
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
];

function model(
  provider: string,
  providerName: string,
  id: string,
  name: string
): Model {
  return { id, name, provider, providerName, thinkingLevels: levels };
}

export const catalog: Catalog = {
  default: { id: 'claude-sonnet-5.5', provider: 'anthropic' },
  models: [
    model('anthropic', 'Anthropic', 'claude-opus-5.5', 'Claude Opus 5.5'),
    model('anthropic', 'Anthropic', 'claude-sonnet-5.5', 'Claude Sonnet 5.5'),
    model('anthropic', 'Anthropic', 'claude-haiku-5.5', 'Claude Haiku 5.5'),
    model('openai', 'OpenAI', 'gpt-5.5', 'GPT-5.5'),
    model('openai', 'OpenAI', 'gpt-5.5-pro', 'GPT-5.5 Pro'),
  ],
};
