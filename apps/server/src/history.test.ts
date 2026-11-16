import { fauxAssistantMessage, fauxToolCall } from '@earendil-works/pi-ai';
import { expect, test } from 'bun:test';

import { signIn } from '../test/auth';
import { call, idle } from '../test/client';
import { script } from '../test/models';
import { flushHistory } from './history';

async function chat(headers: Headers, content: string) {
  const { body } = await call(headers, 'POST', '/conversations', { content });

  await idle(body.id);

  return body.id as number;
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

test('other chats can be searched and read only when allowed', async () => {
  const headers = await signIn();

  const earlier = await chat(headers, 'zebracorn plans');

  await flushHistory();

  await call(headers, 'PATCH', '/memory', { referenceChats: true });

  script(
    tool('chat_search', { query: 'zebracorn quux' }),
    tool('chat_read', { id: earlier }),
    fauxAssistantMessage('bar')
  );

  const allowed = await chat(headers, 'baz');

  await call(headers, 'PATCH', '/memory', { referenceChats: false });

  script(
    tool('chat_search', { query: 'zebracorn' }),
    fauxAssistantMessage('bar')
  );

  const blocked = await chat(headers, 'baz');

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
