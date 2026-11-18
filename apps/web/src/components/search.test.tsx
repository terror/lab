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

function stubWorkspace() {
  stubFetch((_, init) =>
    init?.method === 'POST'
      ? Response.json({ error: 'bar' }, { status: 400 })
      : Response.json({
          chats: [],
          conversations: [],
          default: null,
          files: [],
          models: [],
          projects: [],
          schedules: [],
        })
  );
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
