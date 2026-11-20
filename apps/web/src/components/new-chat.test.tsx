import '@/index.css';
import { TooltipProvider } from '@/components/ui/tooltip';
import { tryPrompt } from '@/lib/capabilities';
import { glideOrigin } from '@/lib/glide';
import { setStorageUser } from '@/lib/storage';
import { renderWithQuery, requestUrl, stubFetch } from '@/test/helpers';
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

async function renderHome({
  chats = [],
  personality = 'default',
  pins = [],
  projects = [],
  start = () => Response.json({ id: 1 }, { status: 201 }),
  tasks = [],
  tried = false,
  unread = () => Response.json({ chats: [], running: 0, waiting: [] }),
  user = 'foo',
}: {
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

  const { screen } = await renderWithQuery(<RouterProvider router={router} />);

  return { fetch, router, screen };
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

test('someone with no chats yet gets a work prompt and what Lab can do', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(new Date(2026, 10, 18, 14).getTime());

  const { screen } = await renderHome();

  const heading = screen.getByRole('heading');

  await expect.element(heading).toBeVisible();

  expect([
    heading.element().textContent,
    heading.element().nextElementSibling?.textContent,
  ]).toEqual([
    'What are we working on?',
    'I’m Lab. I can read, write, run code and remember things. Start anywhere.',
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

test('a new user gets starters that preview in the message box and fill it, below the place work will land', async () => {
  const { screen } = await renderHome();

  const message = screen.getByLabelText('Message');

  const starter = screen.getByRole('button', { name: 'Draw something' });

  await starter.hover();

  await expect
    .element(message)
    .toHaveAttribute('placeholder', 'Make an image of …');

  await starter.click();

  await expect.element(message).toHaveFocus();

  const box = message.element() as HTMLTextAreaElement;

  const list = screen.container.querySelector('[aria-label=Try]');

  expect([
    box.value,
    box.selectionStart,
    box.selectionEnd,
    list?.textContent,
    list && getComputedStyle(list).visibility,
    list?.previousElementSibling?.textContent,
  ]).toEqual([
    'Make an image of …',
    17,
    18,
    'Make an app that remembersRun something every morningDraw something',
    'hidden',
    'Finished work and questions for you will show up here.',
  ]);
});

test('a chat and a project with the same name are both offered', async () => {
  const error = vi.spyOn(console, 'error');

  const { screen } = await renderHome({
    chats: [{ id: 1, projectId: 2, title: 'foo', unread: false }],
    projects: [{ id: 2, name: 'foo' }],
  });

  const list = screen.getByRole('list', { name: 'Pick up' });

  await expect
    .poll(() => list.element().textContent)
    .toBe('fooLast chatfooProject');

  expect(error).not.toHaveBeenCalled();
});

test('the brief counts the work, the list sorts it by what needs you, and a count jumps to its items', async () => {
  const { screen } = await renderHome({
    chats: returning,
    unread: () =>
      Response.json({
        chats: [finished(1)],
        running: 1,
        waiting: [{ id: 2, title: 'baz' }],
      }),
  });

  const list = screen.getByRole('list', { name: 'Activity' });

  await expect
    .poll(() => list.element().textContent)
    .toBe('bazNeeds youReviewfoo 1Unreadbar1m1m1 chat running');

  const focused = [];

  for (const name of ['1 chat finished', '1 needs you', '1 is still running']) {
    await screen.getByRole('button', { name }).click();

    focused.push(document.activeElement?.textContent);
  }

  expect([
    screen.container.querySelector('[data-slot=brief]')?.textContent,
    focused,
  ]).toEqual([
    '1chat finished and 1needs you. 1is still running.',
    ['foo 1Unreadbar', 'Review', '1 chat running'],
  ]);
});

test('a quiet brief is plain counts', async () => {
  const { screen } = await renderHome({
    chats: returning,
    personality: 'quiet',
    unread: () =>
      Response.json({
        chats: [finished(1), finished(2)],
        running: 1,
        waiting: [{ id: 3, title: 'baz' }],
      }),
  });

  await expect
    .element(screen.getByRole('button', { name: '2 finished' }))
    .toBeVisible();

  expect(screen.container.querySelector('[data-slot=brief]')?.textContent).toBe(
    '2finished · 1needs you · 1running'
  );
});

test('a long list stops at six until it is expanded, and clearing it says so', async () => {
  let chats = [1, 2, 3, 4, 5, 6, 7, 8].map(finished);

  const { fetch, screen } = await renderHome({
    chats: returning,
    unread: () => Response.json({ chats, running: 0, waiting: [] }),
  });

  const list = screen.getByRole('list', { name: 'Activity' });

  const rows = () => list.element().children.length;

  await expect.poll(rows).toBe(6);

  await screen.getByRole('button', { name: '+2 more' }).click();

  const expanded = [rows(), document.activeElement?.textContent];

  chats = [];

  await screen.getByRole('button', { name: 'Mark all read' }).click();

  await expect.element(screen.getByText('All caught up')).toBeVisible();

  expect([
    expanded,
    fetch.mock.calls
      .filter(([, init]) => init?.method === 'POST')
      .map(([input]) => requestUrl(input).pathname),
  ]).toEqual([
    [8, 'foo 7Unreadbar'],
    [1, 2, 3, 4, 5, 6, 7, 8].map((id) => `/api/conversations/${id}/read`),
  ]);
});

test('news that arrives late never moves the message box', async () => {
  const news = Promise.withResolvers<Response>();

  const { screen } = await renderHome({
    chats: returning,
    unread: () => news.promise,
  });

  const message = screen.getByLabelText('Message');

  await expect.element(message).toBeVisible();

  const top = () => message.element().getBoundingClientRect().top;

  const before = top();

  news.resolve(
    Response.json({
      chats: [finished(1), finished(2)],
      running: 1,
      waiting: [{ id: 3, title: 'baz' }],
    })
  );

  await expect
    .element(screen.getByRole('list', { name: 'Activity' }))
    .toBeVisible();

  expect(top()).toBe(before);
});

test('on a day with no news, lines to try come from things not already offered, preview on one line and fill the message box', async () => {
  const { screen } = await renderHome({
    chats: [{ id: 1, projectId: 3, title: 'foo', unread: false }],
    pins: [
      { artifactId: 'bar', conversationId: 1, projectId: null, title: 'baz' },
      { artifactId: 'qux', conversationId: 1, projectId: null, title: 'corge' },
    ],
    projects: [
      { id: 3, name: 'qux' },
      { id: 4, name: 'quux' },
    ],
    tried: true,
  });

  const list = screen.getByRole('list', { name: 'Try' });

  await expect
    .poll(() => list.element().textContent)
    .toBe('Catch up on quuxImprove bazDraw something');

  const line = screen.getByRole('button', { name: 'Improve baz' });

  const message = screen.getByLabelText('Message');

  const top = () => line.element().getBoundingClientRect().top;

  const before = top();

  await line.hover();

  await expect
    .poll(() => message.element().getAttribute('placeholder')?.at(-1))
    .toBe('…');

  const shown = message.element().getAttribute('placeholder') ?? '';

  const after = top();

  await line.click();

  await expect
    .element(message)
    .toHaveValue('Suggest three improvements for my baz app.');

  expect([
    after - before,
    'Suggest three improvements for my baz app.'.startsWith(shown.slice(0, -1)),
    screen.getByRole('list', { name: 'Pick up' }).element().textContent,
  ]).toEqual([0, true, 'fooLast chatcorgePinned appquxProject']);
});

test('a failed check for news still shows the page', async () => {
  const { screen } = await renderHome({
    chats: returning,
    unread: () => new Response(null, { status: 500 }),
  });

  await expect.element(screen.getByRole('heading')).toBeVisible();

  await expect
    .element(screen.getByRole('list', { name: 'Pick up' }))
    .toHaveTextContent('quxLast chat');
});

test('marking everything read with a double-click leaves what is below where it was', async () => {
  let chats = [1, 2, 3].map(finished);

  const { router, screen } = await renderHome({
    chats: returning,
    unread: () => Response.json({ chats, running: 0, waiting: [] }),
  });

  const tile = screen.getByRole('link', { name: 'qux Last chat' });

  await expect.element(tile).toBeVisible();

  const top = () => tile.element().getBoundingClientRect().top;

  const before = top();

  chats = [];

  await screen.getByRole('button', { name: 'Mark all read' }).dblClick();

  await expect.element(screen.getByText('All caught up')).toBeVisible();

  expect([top() - before, router.state.location.pathname]).toEqual([0, '/']);
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

  const list = screen.getByRole('list', { name: 'Pick up' });

  await expect
    .poll(() => list.element().textContent)
    .toBe('barLast chatquxProjectcorgeRuns in 2 days');

  await screen.getByRole('link', { name: 'corge Runs in 2 days' }).click();

  await expect.poll(() => router.state.location.pathname).toBe('/scheduled');

  await screen.getByRole('link', { name: 'qux Project' }).click();

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
