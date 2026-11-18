import { TooltipProvider } from '@/components/ui/tooltip';
import { renderWithQuery, stubFetch } from '@/test/helpers';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router';
import { expect, test, vi } from 'vitest';

import { Conversation } from './conversation';

test('a chat stays open when a refresh fails', async () => {
  vi.stubGlobal(
    'EventSource',
    class {
      addEventListener() {}
      close() {}
    }
  );

  let failing = false;

  stubFetch(({ pathname }) => {
    if (failing) {
      return Response.json({ error: 'foo' }, { status: 502 });
    }

    if (pathname === '/api/conversations/1') {
      return Response.json({ forks: [], projectId: null, title: 'bar' });
    }

    return Response.json({});
  });

  const router = createRouter({
    history: createMemoryHistory(),
    routeTree: createRootRoute({
      component: () => (
        <TooltipProvider>
          <Conversation id={1} />
        </TooltipProvider>
      ),
    }),
  });

  const { client, screen } = await renderWithQuery(
    <RouterProvider router={router} />
  );

  await expect
    .element(screen.getByRole('heading', { name: 'bar' }))
    .toBeInTheDocument();

  failing = true;

  await client.refetchQueries();
  await new Promise((resolve) => setTimeout(resolve, 100));

  await expect
    .element(screen.getByRole('heading', { name: 'bar' }))
    .toBeInTheDocument();
  await expect
    .element(screen.getByText('This chat isn’t available'))
    .not.toBeInTheDocument();
});
