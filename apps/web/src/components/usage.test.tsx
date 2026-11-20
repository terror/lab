import { renderWithQuery, stubFetch } from '@/test/helpers';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router';
import { expect, test, vi } from 'vitest';

import { UsagePanel } from './usage';

async function renderUsage() {
  vi.useFakeTimers({ now: new Date('2026-06-01T12:00:00Z'), toFake: ['Date'] });

  const responses: Record<string, unknown> = {
    '/api/preferences': { preferences: {} },
    '/api/usage/budget': { limit: null, spent: 0 },
  };

  stubFetch(({ pathname }) =>
    Response.json(
      responses[pathname] ?? {
        conversations: [],
        daily: [
          { cost: 0, date: '2026-01-01', tokens: 0 },
          { cost: 2, date: '2026-01-02', tokens: 10 },
          { cost: 1, date: '2026-01-03', tokens: 5 },
        ],
        models: [
          {
            cost: 3,
            input: 10,
            model: 'foo',
            name: 'Foo',
            output: 5,
            provider: 'bar',
            responses: 2,
          },
        ],
        summary: { cost: 3, input: 10, output: 5, responses: 2 },
      }
    )
  );

  const router = createRouter({
    history: createMemoryHistory(),
    routeTree: createRootRoute({
      component: UsagePanel,
    }),
  });

  const { screen } = await renderWithQuery(<RouterProvider router={router} />);

  return screen;
}

test('daily spend names its total and its peak day', async ({
  onTestFinished,
}) => {
  onTestFinished(() => {
    vi.useRealTimers();
  });

  const screen = await renderUsage();

  await expect
    .element(screen.getByText(/in total/))
    .toHaveTextContent('$3.00 in total · peak $2.00 on Jan 2');
});

test('focusing a day writes it into the caption', async ({
  onTestFinished,
}) => {
  onTestFinished(() => {
    vi.useRealTimers();
  });

  const screen = await renderUsage();

  const day = screen.getByRole('button', { name: 'Jan 3: $1.00' });

  await expect.element(day).toBeVisible();

  day.element().focus();

  await expect
    .element(screen.getByText(/^Jan 3 ·/))
    .toHaveTextContent('Jan 3 · $1.00 · 5 tokens');
});
