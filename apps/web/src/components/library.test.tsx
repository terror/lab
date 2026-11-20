import { readStored, setStorageUser, writeStored } from '@/lib/storage';
import { renderWithQuery, stubFetch } from '@/test/helpers';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router';
import { expect, test, vi } from 'vitest';
import { z } from 'zod';

import { Library } from './library';

test('a search with no matches offers to show everything', async () => {
  stubFetch(() => Response.json({ items: [], next: null }));

  const router = createRouter({
    history: createMemoryHistory(),
    routeTree: createRootRoute({ component: Library }),
  });

  const { screen } = await renderWithQuery(<RouterProvider router={router} />);

  const search = screen.getByRole('textbox', { name: 'Search library' });

  await search.fill('foo');
  await screen.getByRole('button', { name: 'Show everything' }).click();

  await expect.element(search).toHaveValue('');
  await expect.element(screen.getByText('Empty shelves')).toBeVisible();
});

test('a saved file that is not a pdf opens as text', async () => {
  stubFetch(({ pathname }) => {
    if (pathname === '/api/library/1') {
      return new Response('foo,bar');
    }

    return Response.json({
      items: [
        {
          conversation: { id: 2, title: 'baz' },
          createdAt: new Date(0).toISOString(),
          id: 1,
          kind: 'file',
          mimeType: 'text/plain',
          name: 'foo.csv',
          preview: 'foo,bar',
          size: 7,
          upload: { id: 'qux', mimeType: 'text/csv', thumbnail: false },
        },
      ],
      next: null,
    });
  });

  const router = createRouter({
    history: createMemoryHistory(),
    routeTree: createRootRoute({ component: Library }),
  });

  const { screen } = await renderWithQuery(<RouterProvider router={router} />);

  await screen.getByRole('button', { name: 'foo.csv' }).click();

  await expect
    .element(screen.getByRole('dialog').getByText('foo,bar'))
    .toBeVisible();
});

test('a visit to the Library marks everything before it as seen', async ({
  onTestFinished,
}) => {
  onTestFinished(() => {
    vi.useRealTimers();
  });

  vi.useFakeTimers({ now: new Date('2026-01-02T00:00:00Z'), toFake: ['Date'] });

  setStorageUser('foo');
  writeStored('library-seen', '2026-01-01T00:00:00.000Z');

  stubFetch(() => Response.json({ items: [], next: null }));

  const router = createRouter({
    history: createMemoryHistory(),
    routeTree: createRootRoute({ component: Library }),
  });

  await renderWithQuery(<RouterProvider router={router} />);

  await expect
    .poll(() => readStored('library-seen', z.string(), ''))
    .toBe('2026-01-02T00:00:00.000Z');
});
