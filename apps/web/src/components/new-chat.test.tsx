import { TooltipProvider } from '@/components/ui/tooltip';
import { renderWithQuery, stubFetch } from '@/test/helpers';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { expect, test } from 'vitest';

import { NewChat } from './new-chat';

const DAY = 86_400_000;

async function renderHome({
  chats = [],
  projects = [],
  tasks = [],
}: {
  chats?: object[];
  projects?: object[];
  tasks?: object[];
} = {}) {
  const responses: Record<string, unknown> = {
    '/api/conversations': { conversations: chats, next: null },
    '/api/conversations/unread': { chats: [], running: 0 },
    '/api/models': { default: null, models: [] },
    '/api/profile': {},
    '/api/projects': { projects },
    '/api/schedules': { tasks },
  };

  stubFetch(({ pathname }) =>
    pathname in responses
      ? Response.json(responses[pathname])
      : new Response(null, { status: 204 })
  );

  const rootRoute = createRootRoute();

  const router = createRouter({
    history: createMemoryHistory(),
    routeTree: rootRoute.addChildren(
      ['/', '/c/$id', '/projects/$projectId', '/scheduled'].map((path) =>
        createRoute({
          component: () => (
            <TooltipProvider>
              <NewChat user={{ name: 'Foo Bar' }} />
            </TooltipProvider>
          ),
          getParentRoute: () => rootRoute,
          path,
        })
      )
    ),
  });

  const { screen } = await renderWithQuery(<RouterProvider router={router} />);

  return { router, screen };
}

test('the mark assembles on the first visit of a session and rests after', async () => {
  const states = [];

  for (const _ of [1, 2]) {
    const { screen } = await renderHome();

    await expect.element(screen.getByRole('heading')).toBeVisible();

    states.push(
      screen.container
        .querySelector('[data-slot=live-mark]')
        ?.getAttribute('data-state')
    );

    await screen.unmount();
  }

  expect(states).toEqual(['assemble', 'idle']);
});
