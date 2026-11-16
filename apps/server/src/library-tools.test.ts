import { fauxAssistantMessage } from '@earendil-works/pi-ai';
import { expect, test } from 'bun:test';

import { signIn } from '../test/auth';
import { call, chat, settle, toolOutputs } from '../test/client';
import { script, toolCall } from '../test/models';

test('the agent searches and reads the library in pages', async () => {
  const headers = await signIn();

  await chat(headers, {
    attachments: [{ name: 'foo.txt', text: 'abcdefghij', type: 'file' }],
    content: 'bar',
  });

  await settle();

  const { body } = await call(headers, 'GET', '/library');

  const [item] = body.items;

  script(
    toolCall('library_search', { query: 'foo txt' }),
    toolCall('library_read', { id: item.id, length: 3, offset: 2 }),
    fauxAssistantMessage('baz')
  );

  const id = await chat(headers, { content: 'baz' });

  script(
    toolCall('library_read', { id: item.id }),
    fauxAssistantMessage('baz')
  );

  const stranger = await signIn();

  const other = await chat(stranger, { content: 'baz' });

  expect([
    await toolOutputs(headers, id),
    await toolOutputs(stranger, other),
  ]).toEqual([
    [
      `[${item.id}] foo.txt (file, 10 bytes, ${item.createdAt.slice(0, 10)}, from "foo")`,
      'foo.txt\n\ncde\n\n[Showing characters 2–5 of 10. Call library_read with offset 5 to continue.]',
    ],
    [`No library item has the id ${item.id}.`],
  ]);
});
