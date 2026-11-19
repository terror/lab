import '@/index.css';
import { renderWithQuery, requestUrl, stubFetch } from '@/test/helpers';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router';
import { expect, test } from 'vitest';
import { page } from 'vitest/browser';

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

  await expect.element(nav.getByRole('link', { name: 'Usage' })).toBeVisible();

  await expect
    .poll(() => nav.getByRole('link', { name: 'Providers' }).query() !== null)
    .toBe(admin);

  await screen.unmount();
}

test('only the admin sees provider settings', async () => {
  await sections(true);
  await sections(false);
});

test('a settings section can be linked to directly', async () => {
  await page.viewport(414, 896);

  stubFetch(({ pathname }) =>
    Response.json(
      pathname === '/api/profile'
        ? { admin: false }
        : { instructions: '', memories: [], referenceChats: false }
    )
  );

  const router = createRouter({
    history: createMemoryHistory({ initialEntries: ['/?section=memory'] }),
    routeTree: createRootRoute({ component: Settings }),
  });

  const { screen } = await renderWithQuery(<RouterProvider router={router} />);

  await expect
    .element(screen.getByRole('heading', { level: 1, name: 'Memory' }))
    .toBeVisible();

  await expect
    .element(screen.getByRole('link', { name: 'Settings' }))
    .toHaveAttribute('href', '/settings');
});

test('on a narrow screen the section list opens a section', async () => {
  await page.viewport(414, 896);

  stubFetch(({ pathname }) =>
    Response.json(
      pathname === '/api/profile'
        ? { admin: false }
        : { instructions: '', memories: [], referenceChats: false }
    )
  );

  const router = createRouter({
    history: createMemoryHistory(),
    routeTree: createRootRoute({ component: Settings }),
  });

  const { screen } = await renderWithQuery(<RouterProvider router={router} />);

  await screen.getByRole('link', { name: 'Memory' }).click();

  await expect
    .element(screen.getByRole('heading', { level: 1, name: 'Memory' }))
    .toBeVisible();
});

test('on a wide screen Settings opens on Appearance beside the nav', async () => {
  await page.viewport(1280, 800);

  stubFetch(() => Response.json({ admin: false }));

  const router = createRouter({
    history: createMemoryHistory(),
    routeTree: createRootRoute({ component: Settings }),
  });

  const { screen } = await renderWithQuery(<RouterProvider router={router} />);

  await expect
    .element(
      screen
        .getByRole('navigation', { name: 'Settings' })
        .getByRole('link', { name: 'Appearance' })
    )
    .toHaveAttribute('aria-current', 'page');
  await expect
    .element(screen.getByRole('heading', { level: 1, name: 'Appearance' }))
    .toBeVisible();
});

test('appearance settings save to the account', async () => {
  await page.viewport(1280, 800);

  const fetch = stubFetch(() => Response.json({ admin: false }));

  const router = createRouter({
    history: createMemoryHistory(),
    routeTree: createRootRoute({ component: Settings }),
  });

  const { screen } = await renderWithQuery(<RouterProvider router={router} />);

  await screen.getByRole('button', { name: 'Quiet' }).click();
  await screen.getByRole('button', { name: 'Solarized' }).click();

  await expect
    .poll(() =>
      fetch.mock.calls
        .filter(([, init]) => init?.method === 'PATCH')
        .map(([input, init]) => [requestUrl(input).pathname, init?.body])
    )
    .toEqual([
      ['/api/preferences', JSON.stringify({ personality: 'quiet' })],
      ['/api/preferences', JSON.stringify({ syntaxTheme: 'solarized' })],
    ]);
});
