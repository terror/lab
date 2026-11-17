import { renderWithQuery, requestUrl, stubFetch } from '@/test/helpers';
import { expect, test } from 'vitest';

import { QuestionCard } from './question-card';

test('choosing an option answers the question once', async () => {
  const fetch = stubFetch(() => new Response(null, { status: 204 }));

  const { screen } = await renderWithQuery(
    <QuestionCard
      answer={undefined}
      callId='qux'
      conversationId={7}
      options={['bar', 'baz']}
      question='foo'
    />
  );

  await screen.getByRole('button', { name: 'baz' }).click();

  await expect
    .element(screen.getByRole('button', { name: 'baz' }))
    .toHaveAttribute('aria-pressed', 'true');

  const [input, init] = fetch.mock.calls[0] ?? [];

  expect({
    bar: screen
      .getByRole('button', { name: 'bar' })
      .element()
      .hasAttribute('disabled'),
    body: typeof init?.body === 'string' && JSON.parse(init.body),
    path: input && requestUrl(input).pathname,
  }).toEqual({
    bar: true,
    body: { answer: 'baz', callId: 'qux' },
    path: '/api/conversations/7/answers',
  });
});
