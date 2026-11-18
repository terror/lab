import { renderWithQuery, requestUrl, stubFetch } from '@/test/helpers';
import { QueryClient } from '@tanstack/react-query';
import { expect, test } from 'vitest';

import { QuestionCard } from './question-card';

test('choosing an option answers the question once', async () => {
  const fetch = stubFetch(() => new Response(null, { status: 204 }));

  const { screen } = await renderWithQuery(
    <QuestionCard
      active
      answer={undefined}
      callId='qux'
      conversationId={7}
      options={['bar', 'baz']}
      question='foo'
    />
  );

  await screen.getByRole('button', { name: 'baz' }).click();

  await expect.poll(() => screen.container.textContent).toBe('foobaz');

  const [input, init] = fetch.mock.calls[0] ?? [];

  expect({
    body: typeof init?.body === 'string' && JSON.parse(init.body),
    calls: fetch.mock.calls.length,
    path: input && requestUrl(input).pathname,
  }).toEqual({
    body: { answer: 'baz', callId: 'qux' },
    calls: 1,
    path: '/api/conversations/7/answers',
  });
});

test('answering refreshes which chats need you', async () => {
  stubFetch(() => new Response(null, { status: 204 }));

  const client = new QueryClient();

  client.setQueryData(['conversations', 'unread'], { foo: 'bar' });

  const { screen } = await renderWithQuery(
    <QuestionCard
      active
      answer={undefined}
      callId='qux'
      conversationId={7}
      options={['bar']}
      question='foo'
    />,
    client
  );

  await screen.getByRole('button', { name: 'bar' }).click();

  await expect
    .poll(
      () => client.getQueryState(['conversations', 'unread'])?.isInvalidated
    )
    .toBe(true);
});
