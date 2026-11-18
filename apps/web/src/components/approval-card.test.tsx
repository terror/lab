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
