import { renderWithQuery, stubFetch } from '@/test/helpers';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router';
import { expect, test } from 'vitest';

import { Settings } from './settings';

async function sections(admin: boolean) {
  stubFetch(({ pathname }) =>
    Response.json(pathname === '/api/profile' ? { admin } : {})
  );

  const router = createRouter({
    history: createMemoryHistory(),
    routeTree: createRootRoute({ component: Settings }),
  });

  const { screen } = await renderWithQuery(<RouterProvider router={router} />);

  const nav = screen.getByRole('navigation', { name: 'Settings' });

  await expect
    .element(nav.getByRole('button', { name: 'Usage' }))
    .toBeVisible();

  await expect
    .poll(() => nav.getByRole('button', { name: 'Providers' }).query() !== null)
    .toBe(admin);

  await screen.unmount();
}

test('only the admin sees provider settings', async () => {
  await sections(true);
  await sections(false);
});
