import { renderWithQuery, stubFetch } from '@/test/helpers';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { expect, test } from 'vitest';

import { ProjectMenu } from './project-menu';

test('deleting a project navigates away from a chat inside it', async () => {
  stubFetch(({ pathname }) =>
    pathname === '/api/conversations/8'
      ? Response.json({ id: 8, projectId: 7, running: false, title: 'bar' })
      : new Response(null, { status: 204 })
  );

  const rootRoute = createRootRoute();

  const router = createRouter({
    history: createMemoryHistory({ initialEntries: ['/c/8'] }),
    routeTree: rootRoute.addChildren([
      createRoute({
        getParentRoute: () => rootRoute,
        path: '/',
      }),
      createRoute({
        component: () => (
          <ProjectMenu
            onRename={() => undefined}
            project={{ id: 7, instructions: '', name: 'foo' }}
          />
        ),
        getParentRoute: () => rootRoute,
        params: {
          parse: ({ id }) => ({ id: Number(id) }),
          stringify: ({ id }) => ({ id: String(id) }),
        },
        path: '/c/$id',
      }),
    ]),
  });

  const { screen } = await renderWithQuery(<RouterProvider router={router} />);

  await screen.getByRole('button', { name: 'Options for foo' }).click();
  await screen.getByRole('menuitem', { name: 'Delete' }).click();

  await expect.poll(() => router.state.location.pathname).toBe('/');
});
