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

test('artifacts are updated by unique edits or rewrites and read back', async () => {
  const headers = await signIn();

  script(
    toolCall('artifact_create', {
      content: '<p>foo</p><p>foo</p><b>bar</b>',
      id: 'baz',
      title: 'Baz',
    }),
    toolCall('artifact_update', {
      edits: [{ new: 'qux', old: 'bar' }],
      id: 'baz',
    }),
    toolCall('artifact_update', {
      edits: [{ new: 'qux', old: 'foo' }],
      id: 'baz',
    }),
    toolCall('artifact_update', { content: '<i>foo</i>', id: 'baz' }),
    toolCall('artifact_read', { id: 'baz' }),
    fauxAssistantMessage('done')
  );

  const id = await chat(headers, { content: 'foo' });

  expect(await toolOutputs(headers, id)).toEqual([
    'Showed the artifact "Baz" (baz, version 1, 30 characters) to the user.',
    'Updated the artifact "Baz" (baz) to version 2, 30 characters.',
    'Edit 1 must match exactly once, but its old text matches 2 times.',
    'Updated the artifact "Baz" (baz) to version 3, 10 characters.',
    '"Baz" version 3:\n\n<i>foo</i>',
  ]);
});
