import { renderWithQuery, requestUrl, stubFetch } from '@/test/helpers';
import { expect, test } from 'vitest';

import { Providers } from './providers';

test('deleting a provider asks first', async () => {
  const fetch = stubFetch(({ pathname }) =>
    pathname === '/api/providers'
      ? Response.json({
          providers: [
            {
              configured: true,
              fields: [],
              id: 'foo',
              kind: 'model',
              kindLabel: 'bar',
              name: 'baz',
            },
          ],
        })
      : new Response(null, { status: 204 })
  );

  const { screen } = await renderWithQuery(<Providers />);

  await screen.getByRole('button', { name: 'Actions for baz' }).click();
  await screen.getByRole('menuitem', { name: 'Delete' }).click();
  await screen
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Delete' })
    .click();

  await expect
    .poll(() =>
      fetch.mock.calls.flatMap(([input, init]) =>
        init?.method === 'DELETE' ? [requestUrl(input).pathname] : []
      )
    )
    .toEqual(['/api/providers/foo']);
});
