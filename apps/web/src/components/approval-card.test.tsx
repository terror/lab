import { renderWithQuery, stubFetch } from '@/test/helpers';
import { expect, test } from 'vitest';

import { ApprovalCard } from './approval-card';

test('approving sends the decision and shows it', async () => {
  const fetch = stubFetch(() => new Response(null, { status: 204 }));

  const { screen } = await renderWithQuery(
    <ApprovalCard
      active
      approval={{ action: 'foo', summary: ['bar'] }}
      callId='baz'
      conversationId={7}
    />
  );

  await screen.getByRole('button', { name: 'Approve' }).click();

  await expect.element(screen.getByText('Approved')).toBeVisible();

  const [, init] = fetch.mock.calls[0] ?? [];

  expect(typeof init?.body === 'string' && JSON.parse(init.body)).toEqual({
    answer: 'approved',
    callId: 'baz',
  });
});

async function shown(summary: string[]) {
  const { screen } = await renderWithQuery(
    <ApprovalCard
      active
      approval={{ action: 'foo', summary }}
      callId='baz'
      conversationId={7}
    />
  );

  const card = screen.getByRole('group', { name: 'foo' }).element();

  const found = {
    buttons: [...card.querySelectorAll('button')].map(
      ({ dataset, textContent }) => [textContent, dataset.size, dataset.variant]
    ),
    sections: [...(card.firstElementChild?.children ?? [])].map(
      ({ textContent }) => textContent
    ),
  };

  await screen.unmount();

  return found;
}

test('an approval lists its scope above Approve and Deny at equal weight', async () => {
  const buttons = [
    ['Approve', 'sm', 'outline'],
    ['Deny', 'sm', 'outline'],
  ];

  expect([await shown(['bar', 'qux']), await shown([])]).toEqual([
    { buttons, sections: ['Needs youfoo', 'barqux', 'ApproveDeny'] },
    { buttons, sections: ['Needs youfoo', 'ApproveDeny'] },
  ]);
});
