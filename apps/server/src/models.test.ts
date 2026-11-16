import { expect, test } from 'bun:test';

import { signIn } from '../test/auth';
import { call } from '../test/client';

test('models from configured providers are listed', async () => {
  const { body } = await call(await signIn(), 'GET', '/models');

  expect({ default: body.default, model: body.models[0] }).toEqual({
    default: {
      id: 'anthropic/claude-sonnet-5.5',
      provider: 'vercel-ai-gateway',
    },
    model: {
      contextWindow: 128_000,
      id: 'alibaba/qwen3-coder',
      name: 'alibaba/qwen3-coder',
      provider: 'vercel-ai-gateway',
      providerName: 'vercel-ai-gateway',
      thinkingLevels: ['off'],
    },
  });
});

test('models are sorted newest first within each provider', async () => {
  const { body } = await call(await signIn(), 'GET', '/models');

  expect(body.models.map(({ id }: { id: string }) => id)).toEqual([
    'alibaba/qwen3-coder',
    'anthropic/claude-sonnet-5.5',
    'anthropic/claude-haiku-5.5',
  ]);
});
