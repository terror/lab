import { expect, test } from 'bun:test';

import { signIn } from '../test/auth';
import { call } from '../test/client';

test('models are listed with their prices', async () => {
  const { body } = await call(await signIn(), 'GET', '/models');

  expect(body.models[0]).toEqual({
    contextWindow: 1_000_000,
    cost: { input: 2, output: 10 },
    id: 'anthropic/claude-sonnet-5.5',
    images: true,
    maxTokens: 128_000,
    name: 'Claude Sonnet 5.5',
    provider: 'Anthropic',
    reasoning: true,
    thinkingLevels: ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'],
  });
});
