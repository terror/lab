import { Toaster } from '@/components/ui/sonner';
import { queryClient } from '@/lib/query-client';
import { renderWithQuery, stubFetch } from '@/test/helpers';
import type { QueryClient } from '@tanstack/react-query';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router';
import { expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';

import { SearchProvider } from './search';

const pinned = [{ id: 6, projectId: null, title: 'foo' }];

const recent = Array.from({ length: 6 }, (_, index) => ({
  id: index + 1,
  projectId: null,
  title: 'bar',
}));

function stubWorkspace() {
  stubFetch(({ pathname, searchParams }, init) => {
    if (init?.method === 'POST') {
      return Response.json({ error: 'bar' }, { status: 400 });
    }

    if (pathname === '/api/conversations') {
      return Response.json({
        conversations:
          searchParams.get('filter') === 'pinned' ? pinned : recent,
        next: null,
      });
    }

    return Response.json({
      chats: [],
      default: null,
      files: [],
      models: [],
      projects: [],
      schedules: [],
    });
  });
}

async function openSearch(client?: QueryClient) {
  const router = createRouter({
    history: createMemoryHistory(),
    routeTree: createRootRoute({
      component: () => <SearchProvider>{null}</SearchProvider>,
    }),
  });

  const { screen } = await renderWithQuery(
    <>
      <RouterProvider router={router} />
      <Toaster />
    </>,
    client
  );

  await userEvent.keyboard('{Meta>}k{/Meta}');

  return { router, screen };
}

function values() {
  return [...document.querySelectorAll('[cmdk-item]')].map((item) =>
    item.getAttribute('data-value')
  );
}

test('an empty query lists pinned chats before recent ones', async () => {
  stubWorkspace();

  await openSearch();

  await expect
    .poll(values)
    .toEqual([
      'recent-6',
      'recent-1',
      'recent-2',
      'recent-3',
      'recent-4',
      'new-chat',
      'new-project',
      'theme',
      'settings',
    ]);
});

test('asking Lab reports a failure to start the chat', async () => {
  stubWorkspace();

  const { screen } = await openSearch(queryClient);

  await screen.getByRole('combobox', { name: 'Search Lab' }).fill('foo');
  await userEvent.keyboard('{Meta>}{Enter}{/Meta}');

  await expect.element(screen.getByText('bar')).toBeVisible();
});

test('the search box points at the selected result', async () => {
  stubWorkspace();

  const { screen } = await openSearch();

  const input = screen.getByRole('combobox', { name: 'Search Lab' });

  await input.fill('trash');

  await expect.poll(values).toEqual(['settings-trash', 'ask']);

  await userEvent.keyboard('{ArrowDown}');

  const selected = screen.getByRole('option', { selected: true });

  await expect.element(selected).toHaveAttribute('data-value', 'ask');
  await expect
    .element(input)
    .toHaveAttribute('aria-activedescendant', selected.element().id);
});
