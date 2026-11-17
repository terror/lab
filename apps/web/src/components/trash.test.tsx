import { renderWithQuery, requestUrl, stubFetch } from '@/test/helpers';
import { expect, test } from 'vitest';

import { Trash } from './trash';

test('trashed chats can be restored or deleted forever', async () => {
  const fetch = stubFetch(({ pathname }) =>
    pathname === '/api/trash'
      ? Response.json({
          items: [
            {
              deletedAt: '2026-01-02T00:00:00.000Z',
              id: 7,
              kind: 'conversation',
              title: 'foo',
            },
          ],
        })
      : new Response(null, { status: 204 })
  );

  const { screen } = await renderWithQuery(<Trash />);

  await screen.getByRole('button', { name: 'Restore foo' }).click();
  await screen.getByRole('button', { name: 'Empty trash' }).click();
  await screen.getByRole('button', { name: 'Delete forever' }).click();

  await expect
    .poll(() =>
      fetch.mock.calls.flatMap(([input, init]) =>
        init?.method && init.method !== 'GET'
          ? [[init.method, requestUrl(input).pathname]]
          : []
      )
    )
    .toEqual([
      ['POST', '/api/trash/conversation/7/restore'],
      ['DELETE', '/api/trash'],
    ]);
});
