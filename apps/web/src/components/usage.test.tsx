import { TooltipProvider } from '@/components/ui/tooltip';
import { renderWithQuery, stubFetch } from '@/test/helpers';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router';
import { expect, test } from 'vitest';

import { UsagePanel } from './usage';

test('daily spend names its total and its peak day', async () => {
  stubFetch(({ pathname }) =>
    Response.json(
      pathname === '/api/usage/budget'
        ? { limit: null, spent: 0 }
        : {
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
      component: () => (
        <TooltipProvider>
          <UsagePanel />
        </TooltipProvider>
      ),
    }),
  });

  const { screen } = await renderWithQuery(<RouterProvider router={router} />);

  await expect
    .element(screen.getByText(/in total/))
    .toHaveTextContent('$3.00 in total · peak $2.00 on Jan 2');
});
