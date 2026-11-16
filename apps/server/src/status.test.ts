import type { ConversationView } from '@earendil-works/pi-durable';
import { helperModel } from '@lab/harness';
import { expect, spyOn, test } from 'bun:test';

import { models } from './models';
import { subscribeStatus } from './status';

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

test('thinking is summarized once for every tab watching a chat', async () => {
  const sent: string[] = [];

  const subscribe = (tab: string) =>
    subscribeStatus(1, async (status) => {
      sent.push(`${tab}: ${status}`);
    });

  const [foo, bar] = [subscribe('foo'), subscribe('bar')];

  const complete = spyOn(models, 'completeSimple');

  await Promise.all([
    foo.report(view('foo'.repeat(100))),
    bar.report(view('foo'.repeat(100))),
  ]);

  await foo.report(view('foo'.repeat(200)));

  foo.unsubscribe();
  bar.unsubscribe();

  expect({
    models: complete.mock.calls.map(([model]) => model.id),
    sent,
  }).toEqual({
    models: ['anthropic/claude-haiku-5.5'],
    sent: ['foo: foo', 'bar: foo'],
  });

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
