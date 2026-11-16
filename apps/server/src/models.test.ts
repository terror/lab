import { expect, test } from 'bun:test';

import { signIn } from '../test/auth';
import { call } from '../test/client';

test('every gateway model is listed', async () => {
  const { body } = await call(await signIn(), 'GET', '/models');

  expect({
    default: body.default,
    model: body.models.find(
      ({ id }: { id: string }) => id === 'openai/gpt-5.5'
    ),
  }).toEqual({
    default: 'anthropic/claude-sonnet-5.5',
    model: {
      contextWindow: 1_000_000,
      id: 'openai/gpt-5.5',
      images: true,
      maxTokens: 128_000,
      name: 'GPT 5.5',
      provider: 'OpenAI',
      reasoning: true,
      thinkingLevels: ['off', 'minimal', 'low', 'medium', 'high', 'xhigh'],
    },
  });
});
