import { TooltipProvider } from '@/components/ui/tooltip';
import { renderWithQuery, requestUrl, stubFetch } from '@/test/helpers';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';

import { StartComposer } from './start-composer';

test('starting a chat sends the prompt and clears the draft', async () => {
  const fetch = stubFetch(({ pathname }, init) =>
    pathname === '/api/conversations' && init?.method === 'POST'
      ? Response.json({ id: 1 }, { status: 201 })
      : Response.json({ default: null, models: [] })
  );

  const rootRoute = createRootRoute();

  const router = createRouter({
    history: createMemoryHistory(),
    routeTree: rootRoute.addChildren([
      createRoute({
        component: () => (
          <TooltipProvider>
            <StartComposer
              draft='scheduled'
              prompt={(content) => `bar ${content}`}
            />
          </TooltipProvider>
        ),
        getParentRoute: () => rootRoute,
        path: '/',
      }),
      createRoute({
        component: () => null,
        getParentRoute: () => rootRoute,
        path: '/c/$id',
      }),
    ]),
  });

  const { screen } = await renderWithQuery(<RouterProvider router={router} />);

  await screen.getByLabelText('Message').fill('foo');
  await screen.getByLabelText('Message').click();
  await userEvent.keyboard('{Enter}');

  await expect.poll(() => router.state.location.pathname).toBe('/c/1');

  const [, init] =
    fetch.mock.calls.find(
      ([input, request]) =>
        request?.method === 'POST' &&
        requestUrl(input).pathname === '/api/conversations'
    ) ?? [];

  expect(typeof init?.body === 'string' && JSON.parse(init.body).content).toBe(
    'bar foo'
  );

  await expect
    .poll(() => window.localStorage.getItem('lab:foo:draft:scheduled'))
    .toBeNull();
});

test('option-enter or the menu starts a chat in the background and stays on the page', async () => {
  const fetch = stubFetch(({ pathname }, init) =>
    pathname === '/api/conversations' && init?.method === 'POST'
      ? Response.json({ id: 1 }, { status: 201 })
      : Response.json({ default: null, models: [] })
  );

  const rootRoute = createRootRoute();

  const router = createRouter({
    history: createMemoryHistory(),
    routeTree: rootRoute.addChildren([
      createRoute({
        component: () => (
          <TooltipProvider>
            <StartComposer background draft='scheduled' />
          </TooltipProvider>
        ),
        getParentRoute: () => rootRoute,
        path: '/',
      }),
      createRoute({
        component: () => null,
        getParentRoute: () => rootRoute,
        path: '/c/$id',
      }),
    ]),
  });

  const { screen } = await renderWithQuery(<RouterProvider router={router} />);

  const message = screen.getByLabelText('Message');

  const started = () =>
    fetch.mock.calls
      .filter(
        ([input, request]) =>
          request?.method === 'POST' &&
          requestUrl(input).pathname === '/api/conversations'
      )
      .map(
        ([, request]) =>
          typeof request?.body === 'string' && JSON.parse(request.body).content
      );

  await message.fill('foo');
  await message.click();
  await userEvent.keyboard('{Alt>}{Enter}{/Alt}');

  await expect.element(message).toHaveValue('');

  await message.fill('bar');
  await screen.getByRole('button', { name: 'Add photos and files' }).click();
  await screen.getByRole('menuitem', { name: /^Start in background/ }).click();

  await expect.element(message).toHaveValue('');

  expect([started(), router.state.location.pathname]).toEqual([
    ['foo', 'bar'],
    '/',
  ]);
});
