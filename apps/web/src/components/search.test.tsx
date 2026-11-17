import { Toaster } from '@/components/ui/sonner';
import { queryClient } from '@/lib/query-client';
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

test('asking Lab reports a failure to start the chat', async () => {
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
    queryClient
  );

  await userEvent.keyboard('{Meta>}k{/Meta}');
  await screen.getByRole('textbox', { name: 'Search Lab' }).fill('foo');
  await userEvent.keyboard('{Meta>}{Enter}{/Meta}');

  await expect.element(screen.getByText('bar')).toBeVisible();
});
