import { fauxAssistantMessage } from '@earendil-works/pi-ai';
import { expect, test } from 'bun:test';

import { signIn } from '../test/auth';
import { call, chat, settle, toolOutputs } from '../test/client';
import { script, toolCall } from '../test/models';

test('other chats can be searched and read only when allowed', async () => {
  const headers = await signIn();

  const earlier = await chat(headers, { content: 'zebracorn plans' });

  await settle();

  await call(headers, 'PATCH', '/memory', { referenceChats: true });

  script(
    toolCall('chat_search', { query: 'zebracorn quux' }),
    toolCall('chat_read', { id: earlier }),
    fauxAssistantMessage('bar')
  );

  const allowed = await chat(headers, { content: 'baz' });

  await call(headers, 'PATCH', '/memory', { referenceChats: false });

  script(
    toolCall('chat_search', { query: 'zebracorn' }),
    fauxAssistantMessage('bar')
  );

  const blocked = await chat(headers, { content: 'baz' });

  const [searched = '', read = ''] = await toolOutputs(headers, allowed);

  expect({
    blocked: await toolOutputs(headers, blocked),
    read,
    searched: searched.replace(/\(\d{4}-\d{2}-\d{2}\)/, '(date)'),
  }).toEqual({
    blocked: [
      'Referencing other chats is turned off. The user can turn it on in Settings → Memory.',
    ],
    read: 'foo\n\nuser: zebracorn plans\n\nassistant: foo',
    searched: `[${earlier}] foo (date): **zebracorn** plans`,
  });
});

test('a branched chat is read with the messages it shares', async () => {
  const headers = await signIn();

  const id = await chat(headers, { content: 'foo' });

  await call(headers, 'POST', `/conversations/${id}/messages`, {
    content: 'bar',
  });

  await settle(id);

  const { body } = await call(
    headers,
    'GET',
    `/conversations/${id}/entries?order=ascending`
  );

  const { body: branch } = await call(
    headers,
    'POST',
    `/conversations/${id}/branches`,
    {
      content: 'baz',
      entryId: body.items.findLast(
        ({ kind }: { kind: string }) => kind === 'lab.message'
      ).id,
      kind: 'edit',
    }
  );

  await settle(branch.id);

  await call(headers, 'PATCH', '/memory', { referenceChats: true });

  script(toolCall('chat_read', { id: branch.id }), fauxAssistantMessage('qux'));

  const reader = await chat(headers, { content: 'quux' });

  expect(await toolOutputs(headers, reader)).toEqual([
    'foo\n\nuser: foo\n\nassistant: foo\n\nuser: baz\n\nassistant: foo',
  ]);
});
