import { renderWithQuery, requestUrl, stubFetch } from '@/test/helpers';
import { QueryClient } from '@tanstack/react-query';
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

test('deleting a project forever clears the drafts of its chats', async () => {
  stubFetch(({ pathname }) =>
    pathname === '/api/trash'
      ? Response.json({
          items: [
            {
              deletedAt: '2026-01-02T00:00:00.000Z',
              id: 7,
              kind: 'project',
              title: 'foo',
            },
          ],
        })
      : Response.json({ chats: [8] })
  );

  window.localStorage.setItem('lab:foo:draft:8', '"bar"');

  const { screen } = await renderWithQuery(<Trash />);

  await screen.getByRole('button', { name: 'Actions for foo' }).click();
  await screen.getByRole('menuitem', { name: 'Delete forever' }).click();
  await screen
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Delete forever' })
    .click();

  await expect
    .poll(() => window.localStorage.getItem('lab:foo:draft:8'))
    .toBe(null);
});

test('the trash loads again after a failed load', async () => {
  stubFetch(() => Response.json({ items: [] })).mockResolvedValueOnce(
    new Response(null, { status: 500 })
  );

  const { screen } = await renderWithQuery(
    <Trash />,
    new QueryClient({ defaultOptions: { queries: { retry: false } } })
  );

  await screen.getByRole('button', { name: 'Retry' }).click();

  await expect.element(screen.getByText('Nothing to throw out')).toBeVisible();
});
