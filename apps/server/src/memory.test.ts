import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { fauxAssistantMessage } from '@earendil-works/pi-ai';
import { memory } from '@lab/harness';
import { expect, test } from 'bun:test';

import { signIn } from '../test/auth';
import { call, chat, toolDetails } from '../test/client';
import { script, toolCall } from '../test/models';

test('memories and instructions can be managed', async () => {
  const headers = await signIn();

  await call(headers, 'PATCH', '/memory', { instructions: 'foo' });

  const added = await call(headers, 'POST', '/memory', { text: 'bar' });

  const [entry] = added.body.memories;

  expect([
    added.status,
    await call(headers, 'DELETE', `/memory/${entry.id}`),
    await call(headers, 'DELETE', `/memory/${entry.id}`),
  ]).toEqual([
    201,
    {
      body: { instructions: 'foo', memories: [], referenceChats: false },
      status: 200,
    },
    { body: { error: 'Memory not found' }, status: 404 },
  ]);

  await call(headers, 'PATCH', '/memory', { instructions: '' });
});

test('the agent remembers and forgets facts', async () => {
  const headers = await signIn();

  script(toolCall('remember', { text: 'baz' }), fauxAssistantMessage('foo'));

  const remembered = await chat(headers, { content: 'foo' });

  const [{ id }] = (await call(headers, 'GET', '/memory')).body.memories;

  script(toolCall('forget', { id }), fauxAssistantMessage('foo'));

  const forgotten = await chat(headers, { content: 'foo' });

  expect({
    details: [
      ...(await toolDetails(headers, remembered)),
      ...(await toolDetails(headers, forgotten)),
    ],
    memories: (await call(headers, 'GET', '/memory')).body.memories,
  }).toEqual({
    details: [
      { id, text: 'baz' },
      { id, text: 'baz' },
    ],
    memories: [],
  });
});

test('instructions and memories are added to the prompt', async () => {
  const [section] = memory.sections ?? [];

  const render = (doc: unknown) =>
    section?.render(
      {
        read: { snapshot: async () => doc },
      } as unknown as Parameters<NonNullable<typeof section>['render']>[0],
      BACKGROUND_CONTEXT
    );

  expect([
    await render(undefined),
    await render({ instructions: '', memories: [] }),
    await render({
      instructions: 'foo',
      memories: [{ createdAt: 0, id: 'bar', text: 'baz' }],
    }),
  ]).toEqual([
    undefined,
    undefined,
    "The user's custom instructions:\nfoo\n\nThings you remember about the user, with their ids for the forget tool:\n- [bar] baz",
  ]);
});
