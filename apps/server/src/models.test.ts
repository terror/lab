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
      id: 'anthropic/claude-sonnet-5.5',
      images: true,
      maxTokens: 16_384,
      name: 'anthropic/claude-sonnet-5.5',
      provider: 'vercel-ai-gateway',
      providerName: 'vercel-ai-gateway',
      reasoning: false,
      thinkingLevels: ['off'],
    },
  });
});
