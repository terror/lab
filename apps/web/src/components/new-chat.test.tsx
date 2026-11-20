import '@/index.css';
import { TooltipProvider } from '@/components/ui/tooltip';
import { tryPrompt } from '@/lib/capabilities';
import { glideOrigin } from '@/lib/glide';
import { setStorageUser } from '@/lib/storage';
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

function finished(id: number) {
  return {
    finishedAt: new Date().toISOString(),
    id,
    preview: 'bar',
    scheduled: false,
    title: `foo ${id}`,
  };
}

const returning = [{ id: 9, projectId: null, title: 'qux', unread: false }];

const question = {
  callId: 'corge',
  kind: 'question',
  options: ['grault', 'garply'],
  question: 'waldo',
};

function asking(ask: object) {
  return { ask, id: 2, title: 'baz' };
}

function settle() {
  return new Promise((resolve) => {
    setTimeout(resolve, 450);
  });
}

async function renderHome({
  answer = () => new Response(null, { status: 204 }),
  chats = [],
  personality = 'default',
  pins = [],
  projects = [],
  start = () => Response.json({ id: 1 }, { status: 201 }),
  tasks = [],
  tried = false,
  unread = () => Response.json({ chats: [], runs: [], waiting: [] }),
  user = 'foo',
}: {
  answer?: () => Response;
  chats?: object[];
  personality?: string;
  pins?: object[];
  projects?: object[];
  start?: () => Response | Promise<Response>;
  tasks?: object[];
  tried?: boolean;
  unread?: () => Response | Promise<Response>;
  user?: string;
} = {}) {
  const preferences = { ...defaultPreferences, personality };

  window.localStorage.setItem(
    'lab:foo:preferences',
    JSON.stringify(preferences)
  );

  const responses: Record<string, unknown> = {
    '/api/capabilities': {
      tried: {
        apps: tried,
        branches: tried,
        helpers: tried,
        images: false,
        plan: tried,
        schedules: tried,
      },
    },
    '/api/conversations': { conversations: chats, next: null },
    '/api/conversations/pins': { pins },
    '/api/models': { default: null, models: [] },
    '/api/preferences': { preferences },
    '/api/profile': {},
    '/api/projects': { projects },
    '/api/schedules': { tasks },
  };

  const fetch = stubFetch(({ pathname }, init) => {
    if (init?.method === 'POST' && pathname === '/api/conversations') {
      return start();
    }

    if (pathname === '/api/conversations/unread') {
      return unread();
    }

    if (pathname.endsWith('/answers')) {
      return answer();
    }

    return pathname in responses
      ? Response.json(responses[pathname])
      : new Response(null, { status: 204 });
  });

  const rootRoute = createRootRoute();

  const router = createRouter({
    history: createMemoryHistory(),
    routeTree: rootRoute.addChildren(
      [
        '/',
        '/apps/$conversationId/$artifactId',
        '/c/$id',
        '/projects/$projectId',
        '/scheduled',
      ].map((path) =>
        createRoute({
          component: () => (
            <TooltipProvider>
              <div className='flex h-screen flex-col'>
                <NewChat user={{ id: user }} />
              </div>
            </TooltipProvider>
          ),
          getParentRoute: () => rootRoute,
          path,
        })
      )
    ),
  });

  const { client, screen } = await renderWithQuery(
    <RouterProvider router={router} />
  );

  return { client, fetch, router, screen };
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

test('the next user in the same tab gets a first visit of their own', async () => {
  const states = [];

  for (const user of ['foo', 'bar']) {
    setStorageUser(user);

    const { screen } = await renderHome({ user });

    await expect.element(screen.getByRole('heading')).toBeVisible();

    states.push(
      screen.container
        .querySelector('[data-slot=live-mark]')
        ?.getAttribute('data-state')
    );

    await screen.unmount();
  }

  expect(states).toEqual(['assemble', 'assemble']);
});

test('the first home visit of a new day in the same tab is a first visit', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });

  const states = [];

  try {
    for (const day of [16, 18]) {
      vi.setSystemTime(new Date(2026, 10, day, 9));

      const { screen } = await renderHome();

      await expect.element(screen.getByRole('heading')).toBeVisible();

      states.push(
        screen.container
          .querySelector('[data-slot=live-mark]')
          ?.getAttribute('data-state')
      );

      await screen.unmount();
    }
  } finally {
    vi.useRealTimers();
  }

  expect(states).toEqual(['assemble', 'assemble']);
});

test('the greeting stays the same throughout a session', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });

  const greetings = [];

  try {
    for (const hour of [14, 20]) {
      vi.setSystemTime(new Date(2026, 10, 18, hour));

      const { screen } = await renderHome({
        chats: [{ id: 1, projectId: null, title: 'foo', unread: false }],
      });

      await expect.element(screen.getByRole('heading')).toBeVisible();

      greetings.push(screen.getByRole('heading').element().textContent);

      await screen.unmount();
    }
  } finally {
    vi.useRealTimers();
  }

  expect(greetings).toEqual([
    'What are we working on?',
    'What are we working on?',
  ]);
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

test('trying a prompt drafts it and selects its blank', async () => {
  setStorageUser('foo');

  const { screen } = await renderHome();

  await expect.element(screen.getByLabelText('Message')).toBeVisible();

  tryPrompt('foo … bar');

  const message = screen.getByLabelText('Message').element();

  await expect.poll(() => document.activeElement).toBe(message);

  expect(
    message instanceof HTMLTextAreaElement && [
      message.selectionStart,
      message.selectionEnd,
    ]
  ).toEqual([4, 5]);
});

test('home shows only the mark, the greeting and the message box, even with news', async () => {
  const { screen } = await renderHome({
    chats: returning,
    unread: () =>
      Response.json({
        chats: [finished(1)],
        runs: [{ id: 3, startedAt: new Date().toISOString(), title: 'quux' }],
        waiting: [asking(question)],
      }),
  });

  await expect.element(screen.getByRole('heading')).toBeVisible();

  await settle();

  expect(
    ['foo 1', 'bar', 'baz', 'quux', 'waldo', 'qux'].filter((text) =>
      screen.container.textContent?.includes(text)
    )
  ).toEqual([]);
});
