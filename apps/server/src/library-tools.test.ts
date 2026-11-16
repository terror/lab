import { fauxAssistantMessage, fauxToolCall } from '@earendil-works/pi-ai';
import { expect, test } from 'bun:test';

import { signIn } from '../test/auth';
import { call, idle } from '../test/client';
import { script } from '../test/models';
import { flushLibrary } from './library';

async function chat(headers: Headers, body: object) {
  const { body: created } = await call(headers, 'POST', '/conversations', body);

  await idle(created.id);

  return created.id as number;
}

async function toolOutputs(headers: Headers, id: number) {
  const { body } = await call(
    headers,
    'GET',
    `/conversations/${id}/entries?order=ascending`
  );

  return body.items.flatMap(
    ({ model }: { model?: { content: { text?: string }[]; role: string }[] }) =>
      model?.[0]?.role === 'toolResult'
        ? [model[0].content.map(({ text }) => text).join('')]
        : []
  );
}

function tool(name: string, args: Parameters<typeof fauxToolCall>[1]) {
  return fauxAssistantMessage(fauxToolCall(name, args), {
    stopReason: 'toolUse',
  });
}

test('the agent searches and reads the library in pages', async () => {
  const headers = await signIn();

  await chat(headers, {
    attachments: [{ name: 'foo.txt', text: 'abcdefghij', type: 'file' }],
    content: 'bar',
  });

  await flushLibrary();

  const { body } = await call(headers, 'GET', '/library');

  const [item] = body.items;

  script(
    tool('library_search', { query: 'foo txt' }),
    tool('library_read', { id: item.id, length: 3, offset: 2 }),
    fauxAssistantMessage('baz')
  );

  const id = await chat(headers, { content: 'baz' });

  script(tool('library_read', { id: item.id }), fauxAssistantMessage('baz'));

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
