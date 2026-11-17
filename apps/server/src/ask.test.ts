import { fauxAssistantMessage } from '@earendil-works/pi-ai';
import { expect, test } from 'bun:test';

import { signIn } from '../test/auth';
import { call, settle, toolOutputs } from '../test/client';
import { script, toolCall } from '../test/models';

type Entry = {
  model?: { content: { id?: string; type: string }[]; role: string }[];
};

async function pendingCall(headers: Headers, id: number) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const { body } = await call(
      headers,
      'GET',
      `/conversations/${id}/entries?order=ascending`
    );

    const found = (body.items as Entry[])
      .flatMap(({ model }) => model?.[0]?.content ?? [])
      .find(({ type }) => type === 'toolCall')?.id;

    if (found) {
      return found;
    }

    await Bun.sleep(20);
  }

  throw new Error('No tool call');
}

test('the agent waits for the user to answer its question', async () => {
  const headers = await signIn();

  script(
    toolCall('ask_user', { options: ['bar', 'baz'], question: 'foo' }),
    fauxAssistantMessage('qux')
  );

  const { body } = await call(headers, 'POST', '/conversations', {
    content: 'foo',
  });

  const callId = await pendingCall(headers, body.id);

  const waiting = await toolOutputs(headers, body.id);

  const answered = await call(
    headers,
    'POST',
    `/conversations/${body.id}/answers`,
    { answer: 'baz', callId }
  );

  await settle(body.id);

  expect({
    answered: answered.status,
    outputs: await toolOutputs(headers, body.id),
    waiting,
  }).toEqual({
    answered: 204,
    outputs: ['The user answered: baz'],
    waiting: [],
  });
});
