import { renderWithQuery, stubFetch } from '@/test/helpers';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router';
import { expect, test } from 'vitest';

import { Computer } from './computer';

test('without a computer the admin is sent to Providers', async () => {
  stubFetch(({ pathname }) =>
    Response.json(
      pathname === '/api/profile'
        ? { admin: true }
        : { computer: null, network: 'full', provider: null }
    )
  );

  const router = createRouter({
    history: createMemoryHistory(),
    routeTree: createRootRoute({ component: Computer }),
  });

  const { screen } = await renderWithQuery(<RouterProvider router={router} />);

  await expect
    .element(screen.getByRole('link', { name: 'Open Providers' }))
    .toHaveAttribute('href', '/settings?section=providers');
});
