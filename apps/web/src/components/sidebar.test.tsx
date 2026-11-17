import { TooltipProvider } from '@/components/ui/tooltip';
import { renderWithQuery, stubFetch } from '@/test/helpers';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router';
import { expect, test } from 'vitest';

import { Sidebar } from './sidebar';

test('clicking the open project collapses and expands its chats', async () => {
  stubFetch(({ pathname, searchParams }) => {
    if (pathname === '/api/projects') {
      return Response.json({
        projects: [{ chats: 1, id: 7, instructions: '', name: 'foo' }],
      });
    }

    const conversations =
      searchParams.get('project') === '7'
        ? [
            {
              id: 1,
              pinned: false,
              projectId: 7,
              running: false,
              title: 'bar',
              unread: false,
            },
          ]
        : [];

    return Response.json({ conversations, next: null });
  });

  const router = createRouter({
    history: createMemoryHistory({ initialEntries: ['/projects/7'] }),
    routeTree: createRootRoute({
      component: () => (
        <TooltipProvider>
          <Sidebar
            onNavigate={() => undefined}
            onProject={() => undefined}
            onSelect={() => undefined}
            selected={undefined}
            user={{
              createdAt: new Date(0),
              email: 'foo@bar.com',
              emailVerified: true,
              id: 'foo',
              name: 'foo',
              updatedAt: new Date(0),
            }}
          />
        </TooltipProvider>
      ),
    }),
  });

  const { screen } = await renderWithQuery(<RouterProvider router={router} />);

  const project = screen.getByRole('button', { name: 'foo', exact: true });

  await expect.element(screen.getByText('bar')).toBeVisible();

  await project.click();

  await expect.element(screen.getByText('bar')).not.toBeInTheDocument();
  await expect.element(project).toHaveAttribute('aria-expanded', 'false');

  await project.click();

  await expect.element(screen.getByText('bar')).toBeVisible();
});
