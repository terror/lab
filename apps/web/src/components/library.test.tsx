import { renderWithQuery, stubFetch } from '@/test/helpers';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router';
import { expect, test } from 'vitest';

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
  await expect
    .element(screen.getByText('Nothing on the shelves yet'))
    .toBeVisible();
});
