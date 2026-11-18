import { TooltipProvider } from '@/components/ui/tooltip';
import { renderWithQuery, requestUrl, stubFetch } from '@/test/helpers';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router';
import { expect, test, vi } from 'vitest';

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

test('next runs stay current while the page is open', async () => {
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));

  stubFetch(({ pathname }) =>
    pathname === '/api/schedules'
      ? Response.json({
          tasks: [
            {
              conversationId: null,
              description: 'bar',
              enabled: true,
              id: 1,
              nextRunAt: '2026-01-01T00:03:00.000Z',
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

  try {
    const { screen } = await renderWithQuery(
      <RouterProvider router={router} />
    );

    await expect
      .element(screen.getByText('bar · Next run in 3 minutes'))
      .toBeVisible();

    vi.advanceTimersByTime(120_000);

    await expect
      .element(screen.getByText('bar · Next run in 1 minute'))
      .toBeVisible();
  } finally {
    vi.useRealTimers();
  }
});
