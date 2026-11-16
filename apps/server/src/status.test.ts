import type { ConversationView } from '@earendil-works/pi-durable';
import { helperModel } from '@lab/harness';
import { expect, spyOn, test } from 'bun:test';

import { models } from './models';
import { StatusReporter } from './status';

function view(thinking: string) {
  return {
    docs: {
      'pi.agent': {
        model: {
          modelId: 'alibaba/qwen3-coder',
          provider: 'vercel-ai-gateway',
        },
      },
      'pi.live': {
        generation: {
          attempt: 1,
          message: { content: [{ thinking, type: 'thinking' }] },
        },
      },
    },
  } as unknown as ConversationView;
}

test('thinking is summarized into a throttled status', async () => {
  const sent: string[] = [];

  const reporter = new StatusReporter(async (status) => {
    sent.push(status);
  }, new AbortController().signal);

  const complete = spyOn(models, 'completeSimple');

  await reporter.report(view('foo'.repeat(100)));
  await reporter.report(view('foo'.repeat(200)));

  expect({
    models: complete.mock.calls.map(([model]) => model.id),
    sent,
  }).toEqual({ models: ['anthropic/claude-haiku-5.5'], sent: ['foo'] });

  complete.mockRestore();
});

function helper(provider: string, modelId: string) {
  return helperModel(models, { modelId, provider })?.id;
}

test('helper models stay on the conversation provider', () => {
  const [groq] = models.getModels('groq');

  expect([
    helper('vercel-ai-gateway', 'alibaba/qwen3-coder'),
    helper('groq', groq?.id ?? ''),
    helper('groq', 'foo'),
  ]).toEqual(['anthropic/claude-haiku-5.5', groq?.id, undefined]);
});
