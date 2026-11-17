import { fauxAssistantMessage } from '@earendil-works/pi-ai';
import { expect, test } from 'bun:test';

import { signIn } from '../test/auth';
import { call, pendingToolCall, settle, toolOutputs } from '../test/client';
import { script, toolCall } from '../test/models';

test('the agent waits for the user to answer its question', async () => {
  const headers = await signIn();

  script(
    toolCall('ask_user', { options: ['bar', 'baz'], question: 'foo' }),
    fauxAssistantMessage('qux')
  );

  const { body } = await call(headers, 'POST', '/conversations', {
    content: 'foo',
  });

  const callId = await pendingToolCall(headers, body.id);

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
