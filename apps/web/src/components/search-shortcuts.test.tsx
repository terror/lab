import { renderWithQuery, stubFetch } from '@/test/helpers';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router';
import { expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';

import { SearchProvider } from './search';

test('keyboard shortcuts open settings and a new chat', async () => {
  stubFetch(() => Response.json({ projects: [] }));

  const router = createRouter({
    history: createMemoryHistory({ initialEntries: ['/foo'] }),
    routeTree: createRootRoute({
      component: () => <SearchProvider>{null}</SearchProvider>,
    }),
  });

  await renderWithQuery(<RouterProvider router={router} />);

  await userEvent.keyboard('{Control>},{/Control}');

  await expect.poll(() => router.state.location.pathname).toBe('/settings');

  await userEvent.keyboard('{Control>}{Shift>}O{/Shift}{/Control}');

  await expect.poll(() => router.state.location.pathname).toBe('/');
});
