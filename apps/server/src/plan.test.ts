import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import type { WatchHandle } from '@earendil-works/chord/watch';
import { fauxAssistantMessage } from '@earendil-works/pi-ai';
import type { Conversation, ConversationId } from '@earendil-works/pi-durable';
import { PlanDoc } from '@lab/harness';
import { expect, spyOn, test } from 'bun:test';

import { signIn } from '../test/auth';
import { call, chat, create, raw, settle, toolOutputs } from '../test/client';
import { prompts, script, toolCall } from '../test/models';
import { harness } from './harness';

const guidance =
  'When a task takes several steps, call plan_update with a short checklist before you start, then update it as you go: mark a step active when you start it and done as soon as it is finished. The user sees the checklist live and can edit it while you work.';

test('the agent follows the plan the user edits while it works', async () => {
  const headers = await signIn();

  const id = await create(headers);

  const edits: Awaited<ReturnType<typeof call>>[] = [];

  script(
    toolCall('plan_update', {
      steps: [
        { status: 'pending', text: 'foo' },
        { status: 'pending', text: 'bar' },
      ],
    }),
    async () => {
      edits.push(
        await call(headers, 'PUT', `/conversations/${id}/plan`, {
          steps: [
            { status: 'done', text: 'foo' },
            { status: 'pending', text: 'baz' },
          ],
        })
      );

      return toolCall('plan_update', {
        steps: [
          { status: 'active', text: 'foo' },
          { status: 'pending', text: 'bar' },
        ],
      });
    },
    toolCall(
      'plan_update',
      {
        steps: [
          { status: 'done', text: 'foo' },
          { status: 'active', text: 'baz' },
        ],
      },
      'qux'
    ),
    fauxAssistantMessage('quux')
  );

  prompts.length = 0;

  await call(headers, 'POST', `/conversations/${id}/messages`, {
    content: 'bar',
  });

  await settle(id);

  expect({
    edits,
    outputs: await toolOutputs(headers, id),
    plan: await harness().snapshot(
      PlanDoc,
      id as ConversationId,
      BACKGROUND_CONTEXT
    ),
    prompts: prompts.map(({ plan }) => plan),
  }).toEqual({
    edits: [{ body: null, status: 204 }],
    outputs: [
      'Updated the plan.',
      'The user edited the plan since you last saw it, so your update was not saved. The plan:\n1. [done] foo\n2. [pending] baz\n\nFollow their plan, and keep their changes if you update it again.',
      'Updated the plan.',
    ],
    plan: {
      author: 'agent',
      callId: 'qux',
      steps: [
        { status: 'done', text: 'foo' },
        { status: 'active', text: 'baz' },
      ],
    },
    prompts: [
      `<plan>\n${guidance}\n</plan>`,
      `<plan>\n${guidance}\n\nThe plan:\n1. [pending] foo\n2. [pending] bar\n</plan>`,
      `<plan>\n${guidance}\n\nThe plan:\n1. [done] foo\n2. [pending] baz\n\nThe user edited the plan. Follow their version, and keep their changes when you update it.\n</plan>`,
      `<plan>\n${guidance}\n\nThe plan:\n1. [done] foo\n2. [active] baz\n</plan>`,
    ],
  });
});

test('only a plan the agent wrote can be edited', async () => {
  const headers = await signIn();

  const id = await create(headers);

  expect(
    await call(headers, 'PUT', `/conversations/${id}/plan`, { steps: [] })
  ).toEqual({ body: { error: 'Plan not found' }, status: 404 });
});

function readEvents(response: Response) {
  return response.body?.pipeThrough(new TextDecoderStream()).getReader();
}

async function nextPlan(
  reader: NonNullable<ReturnType<typeof readEvents>>
): Promise<unknown> {
  const { done, value } = await reader.read();

  if (done) {
    throw new Error('The event stream ended');
  }

  const data = /^event: plan\ndata: (.+)$/m.exec(value)?.[1];

  return data === undefined ? nextPlan(reader) : JSON.parse(data);
}

test('the event stream follows the plan', async () => {
  const headers = await signIn();

  script(
    toolCall(
      'plan_update',
      { steps: [{ status: 'pending', text: 'foo' }] },
      'bar'
    ),
    fauxAssistantMessage('baz')
  );

  const id = await chat(headers, { content: 'foo' });

  const response = await raw(headers, `/conversations/${id}/events`);

  const reader = readEvents(response);

  if (!reader) {
    throw new Error('missing event stream');
  }

  const written = await nextPlan(reader);

  await call(headers, 'PUT', `/conversations/${id}/plan`, {
    steps: [{ status: 'done', text: 'foo' }],
  });

  const edited = await nextPlan(reader);

  await reader.cancel();

  expect([written, edited]).toEqual([
    {
      author: 'agent',
      callId: 'bar',
      steps: [{ status: 'pending', text: 'foo' }],
    },
    {
      author: 'user',
      callId: 'bar',
      steps: [{ status: 'done', text: 'foo' }],
    },
  ]);
});

test('a retried reply starts from the plan it had before it', async () => {
  const headers = await signIn();

  script(
    toolCall(
      'plan_update',
      { steps: [{ status: 'pending', text: 'foo' }] },
      'bar'
    ),
    fauxAssistantMessage('baz'),
    toolCall('plan_update', { steps: [{ status: 'done', text: 'foo' }] }),
    fauxAssistantMessage('qux')
  );

  const id = await chat(headers, { content: 'quux' });

  await call(headers, 'POST', `/conversations/${id}/messages`, {
    content: 'corge',
  });

  await settle(id);

  const { body } = await call(
    headers,
    'GET',
    `/conversations/${id}/entries?order=ascending`
  );

  const retried = (body.items as { id: number; model?: { role: string }[] }[])
    .filter(({ model }) => model?.[0]?.role === 'assistant')
    .at(2);

  prompts.length = 0;

  const { body: branch } = await call(
    headers,
    'POST',
    `/conversations/${id}/branches`,
    { entryId: retried?.id, kind: 'retry' }
  );

  await settle(branch.id);

  expect({
    plan: await harness().snapshot(
      PlanDoc,
      branch.id as ConversationId,
      BACKGROUND_CONTEXT
    ),
    prompts: prompts.map(({ plan }) => plan),
  }).toEqual({
    plan: {
      author: 'agent',
      callId: 'bar',
      steps: [{ status: 'pending', text: 'foo' }],
    },
    prompts: [`<plan>\n${guidance}\n\nThe plan:\n1. [pending] foo\n</plan>`],
  });
});

function watches(results: { value: unknown }[]) {
  return Promise.all(
    results.map(({ value }) => value as Promise<WatchHandle<unknown>>)
  );
}

test('the event stream stops following the plan when it stops following the chat', async () => {
  const headers = await signIn();

  script(
    toolCall(
      'plan_update',
      { steps: [{ status: 'pending', text: 'foo' }] },
      'bar'
    ),
    fauxAssistantMessage('baz')
  );

  const id = await chat(headers, { content: 'foo' });

  const conversation = await harness().conversation(
    id as ConversationId,
    BACKGROUND_CONTEXT
  );

  if (!conversation) {
    throw new Error('missing conversation');
  }

  const views = spyOn(
    Object.getPrototypeOf(conversation) as Conversation,
    'watch'
  );

  const plans = spyOn(harness(), 'watchDoc');

  const response = await raw(headers, `/conversations/${id}/events`);

  const reader = readEvents(response);

  if (!reader) {
    throw new Error('missing event stream');
  }

  await nextPlan(reader);

  for (const view of await watches(views.mock.results)) {
    await view.stop();
  }

  const ends = Promise.all(
    (await watches(plans.mock.results)).map(({ closed }) => closed)
  );

  expect(
    await Promise.race([ends, Bun.sleep(1_000).then(() => 'open')])
  ).toEqual([{ kind: 'stopped' }]);

  await reader.cancel();
});
