import '@/index.css';
import { TooltipProvider } from '@/components/ui/tooltip';
import { glideOrigin } from '@/lib/glide';
import { renderWithQuery, stubFetch } from '@/test/helpers';
import { defaultPreferences } from '@lab/server/schemas';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { expect, test, vi } from 'vitest';

import { NewChat } from './new-chat';

const DAY = 86_400_000;

async function renderHome({
  chats = [],
  personality = 'default',
  projects = [],
  start = () => Response.json({ id: 1 }, { status: 201 }),
  tasks = [],
}: {
  chats?: object[];
  personality?: string;
  projects?: object[];
  start?: () => Response | Promise<Response>;
  tasks?: object[];
} = {}) {
  const preferences = { ...defaultPreferences, personality };

  window.localStorage.setItem(
    'lab:foo:preferences',
    JSON.stringify(preferences)
  );

  const responses: Record<string, unknown> = {
    '/api/conversations': { conversations: chats, next: null },
    '/api/conversations/unread': { chats: [], running: 0 },
    '/api/models': { default: null, models: [] },
    '/api/preferences': { preferences },
    '/api/profile': {},
    '/api/projects': { projects },
    '/api/schedules': { tasks },
  };

  stubFetch(({ pathname }, init) => {
    if (init?.method === 'POST' && pathname === '/api/conversations') {
      return start();
    }

    return pathname in responses
      ? Response.json(responses[pathname])
      : new Response(null, { status: 204 });
  });

  const rootRoute = createRootRoute();

  const router = createRouter({
    history: createMemoryHistory(),
    routeTree: rootRoute.addChildren(
      ['/', '/c/$id', '/projects/$projectId', '/scheduled'].map((path) =>
        createRoute({
          component: () => (
            <TooltipProvider>
              <NewChat user={{ id: 'foo', name: 'Foo Bar' }} />
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

test('the greeting is picked once a session and notices a long absence', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });

  window.localStorage.setItem(
    'lab:foo:last-seen',
    JSON.stringify(new Date(2026, 10, 1).getTime())
  );

  const greetings = [];

  try {
    for (const hour of [14, 20]) {
      vi.setSystemTime(new Date(2026, 10, 18, hour));

      const { screen } = await renderHome();

      await expect.element(screen.getByRole('heading')).toBeVisible();

      greetings.push(screen.getByRole('heading').element().textContent);

      await screen.unmount();
    }
  } finally {
    vi.useRealTimers();
  }

  expect({
    greetings,
    lastSeen: window.localStorage.getItem('lab:foo:last-seen'),
  }).toEqual({
    greetings: ['Welcome back, Foo', 'Welcome back, Foo'],
    lastSeen: String(new Date(2026, 10, 18, 20).getTime()),
  });
});

test('a quiet home shows the mark at rest on the first visit', async () => {
  const { screen } = await renderHome({ personality: 'quiet' });

  await expect.element(screen.getByRole('heading')).toBeVisible();

  expect(
    screen.container
      .querySelector('[data-slot=live-mark]')
      ?.getAttribute('data-state')
  ).toBe('idle');
});

test('a new user gets starters that fill the message box', async () => {
  const { screen } = await renderHome();

  await screen.getByRole('button', { name: 'Plan a trip' }).click();

  const message = screen.getByLabelText('Message');

  await expect.element(message).toHaveValue('Plan a three-day trip to ');
  await expect.element(message).toHaveFocus();
});

test('a chat and a project with the same name are both suggested', async () => {
  const error = vi.spyOn(console, 'error');

  const { screen } = await renderHome({
    chats: [{ id: 1, projectId: 2, title: 'foo', unread: false }],
    projects: [{ id: 2, name: 'foo' }],
  });

  const list = screen.getByRole('list', { name: 'Suggestions' });

  await expect.poll(() => list.element().textContent).toBe('foo foo ');

  expect(error).not.toHaveBeenCalled();
});

test('a returning user gets their latest chat, its project, and the next task', async () => {
  const { router, screen } = await renderHome({
    chats: [
      { id: 1, projectId: null, title: 'foo', unread: true },
      { id: 2, projectId: 3, title: 'bar', unread: false },
    ],
    projects: [
      { id: 4, name: 'baz' },
      { id: 3, name: 'qux' },
    ],
    tasks: [
      {
        conversationId: 5,
        enabled: false,
        nextRunAt: new Date(Date.now() + DAY).toISOString(),
        title: 'quux',
      },
      {
        conversationId: null,
        enabled: true,
        nextRunAt: new Date(Date.now() + 2 * DAY + 60_000).toISOString(),
        title: 'corge',
      },
    ],
  });

  const list = screen.getByRole('list', { name: 'Suggestions' });

  await expect
    .poll(() => list.element().textContent)
    .toBe('bar qux corge in 2 days');

  await screen.getByRole('button', { name: 'corge in 2 days' }).click();

  await expect.poll(() => router.state.location.pathname).toBe('/scheduled');

  await screen.getByRole('button', { name: 'qux' }).click();

  await expect.poll(() => router.state.location.pathname).toBe('/projects/3');
});

test('home steps aside and holds the composer in place while a chat starts', async () => {
  const started = Promise.withResolvers<Response>();

  const { screen } = await renderHome({ start: () => started.promise });

  await screen.getByLabelText('Message').fill('foo');
  await screen.getByRole('button', { name: 'Send' }).click();

  const greeting = screen.getByRole('heading').element().parentElement;

  await expect
    .poll(() => greeting && getComputedStyle(greeting).opacity)
    .toBe('0');

  expect(glideOrigin()).toBeTypeOf('number');

  started.resolve(new Response(null, { status: 500 }));

  await expect.poll(glideOrigin).toBeUndefined();
});
