import { TooltipProvider } from '@/components/ui/tooltip';
import { renderWithQuery, requestUrl, stubFetch } from '@/test/helpers';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router';
import { expect, test } from 'vitest';

import { Scheduled } from './scheduled';

test('deleting a scheduled task asks first', async () => {
  const fetch = stubFetch(({ pathname }) =>
    pathname === '/api/schedules'
      ? Response.json({
          tasks: [
            {
              conversationId: null,
              cron: '0 9 * * 1',
              description: 'bar',
              enabled: true,
              id: 7,
              lastRunAt: null,
              nextRunAt: null,
              prompt: 'baz',
              timezone: 'UTC',
              title: 'foo',
            },
          ],
        })
      : Response.json({ default: null, models: [] })
  );

  const router = createRouter({
    history: createMemoryHistory(),
    routeTree: createRootRoute({
      component: () => (
        <TooltipProvider>
          <Scheduled />
        </TooltipProvider>
      ),
    }),
  });

  const { screen } = await renderWithQuery(<RouterProvider router={router} />);

  await screen.getByRole('button', { name: 'Actions for foo' }).click();
  await screen.getByRole('menuitem', { name: 'Delete' }).click();
  await screen
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Delete' })
    .click();

  await expect
    .poll(() =>
      fetch.mock.calls.flatMap(([input, init]) =>
        init?.method === 'DELETE' ? [requestUrl(input).pathname] : []
      )
    )
    .toEqual(['/api/schedules/7']);
});

test('a task links to its chat and an empty filter says so', async () => {
  stubFetch(({ pathname }) =>
    pathname === '/api/schedules'
      ? Response.json({
          tasks: [
            {
              conversationId: 7,
              description: 'bar',
              enabled: true,
              id: 1,
              nextRunAt: null,
              title: 'foo',
            },
          ],
        })
      : Response.json({ default: null, models: [] })
  );

  const router = createRouter({
    history: createMemoryHistory(),
    routeTree: createRootRoute({
      component: () => (
        <TooltipProvider>
          <Scheduled />
        </TooltipProvider>
      ),
    }),
  });

  const { screen } = await renderWithQuery(<RouterProvider router={router} />);

  await expect
    .element(screen.getByRole('link', { name: /^foo/ }))
    .toHaveAttribute('href', '/c/7');

  await screen.getByRole('button', { name: 'Paused' }).click();

  await expect.element(screen.getByText('No paused tasks')).toBeVisible();
});
