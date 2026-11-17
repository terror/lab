import { TooltipProvider } from '@/components/ui/tooltip';
import { renderWithQuery, requestUrl, stubFetch } from '@/test/helpers';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
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

  const router = createRouter({
    history: createMemoryHistory(),
    routeTree: createRootRoute({
      component: () => (
        <TooltipProvider>
          <StartComposer
            draft='scheduled'
            prompt={(content) => `bar ${content}`}
          />
        </TooltipProvider>
      ),
    }),
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

  expect({
    body: typeof init?.body === 'string' && JSON.parse(init.body).content,
    draft: window.localStorage.getItem('lab:draft:scheduled'),
  }).toEqual({ body: 'bar foo', draft: null });
});
