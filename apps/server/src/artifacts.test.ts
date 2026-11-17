import { fauxAssistantMessage } from '@earendil-works/pi-ai';
import { expect, test } from 'bun:test';

import { signIn } from '../test/auth';
import { chat, toolOutputs } from '../test/client';
import { script, toolCall } from '../test/models';

test('artifacts are shown once per id', async () => {
  const headers = await signIn();

  const artifact = { content: '<p>foo</p>', id: 'bar', title: 'Baz' };

  script(
    toolCall('artifact_create', artifact),
    toolCall('artifact_create', artifact),
    fauxAssistantMessage('qux')
  );

  const id = await chat(headers, { content: 'foo' });

  expect(await toolOutputs(headers, id)).toEqual([
    'Showed the artifact "Baz" (bar, version 1, 10 characters) to the user.',
    'An artifact with the id "bar" already exists.',
  ]);
});
