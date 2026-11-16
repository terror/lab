import { expect, spyOn, test } from 'bun:test';

import { signIn } from '../test/auth';
import { call, idle } from '../test/client';
import { models } from './models';

test('titles are written by the helper model from a short transcript', async () => {
  const complete = spyOn(models, 'completeSimple');

  const { body } = await call(await signIn(), 'POST', '/conversations', {
    content: 'foo'.repeat(1_000),
    model: { id: 'alibaba/qwen3-coder', provider: 'vercel-ai-gateway' },
  });

  await idle(body.id);

  const [model, request] = complete.mock.calls.at(-1) ?? [];

  expect({
    length: request?.messages[0]?.content.length,
    model: model?.id,
  }).toEqual({ length: 2_022, model: 'anthropic/claude-haiku-5.5' });

  complete.mockRestore();
});
