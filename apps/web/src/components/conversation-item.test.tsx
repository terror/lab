import '@/index.css';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/sonner';
import { conversationsQueryKey } from '@/lib/conversations';
import { renderWithQuery, requestUrl, stubFetch } from '@/test/helpers';
import { useQuery } from '@tanstack/react-query';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router';
import { useState } from 'react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { userEvent } from 'vitest/browser';

import { ConversationItem } from './conversation-item';

async function row(
  change: { running?: boolean; unread?: boolean; waiting?: boolean },
  selected = false
) {
  const router = createRouter({
    history: createMemoryHistory(),
    routeTree: createRootRoute({
      component: () => (
        <ul>
          <ConversationItem
            conversation={{
              id: 1,
              pinned: false,
              projectId: null,
              running: false,
              title: 'foo',
              unread: false,
              waiting: false,
              ...change,
            }}
            onSelect={() => undefined}
            selected={selected}
          />
        </ul>
      ),
    }),
  });

  const { screen } = await renderWithQuery(<RouterProvider router={router} />);

  const link = screen.getByRole('link', { name: /^foo/ });

  await expect.element(link).toHaveAttribute('href', '/c/1');

  const mark = document
    .querySelector('[data-slot=list-row-status] > [data-slot]')
    ?.getAttribute('data-slot');

  const text = link.element().textContent;

  await screen.unmount();

  return [text, mark];
}

test('chat rows show and name what each chat is doing', async () => {
  expect([
    await row({}),
    await row({ running: true }),
    await row({ running: true, waiting: true }),
    await row({ unread: true }),
    await row({ unread: true }, true),
  ]).toEqual([
    ['foo', undefined],
    ['fooRunning', 'live-mark'],
    ['fooNeeds you', 'dot'],
    ['fooUnread', 'dot'],
    ['foo', undefined],
  ]);
});

function Naming() {
  const [title, setTitle] = useState<string | null>(null);

  return (
    <>
      <Button onClick={() => setTitle('foo bar baz')}>qux</Button>
      <ul>
        <ConversationItem
          conversation={{
            id: 1,
            pinned: false,
            projectId: null,
            running: false,
            title,
            unread: false,
            waiting: false,
          }}
          selected={false}
        />
      </ul>
    </>
  );
}

test('a chat’s first title fades in word by word with a yellow wash', async () => {
  const router = createRouter({
    history: createMemoryHistory(),
    routeTree: createRootRoute({ component: Naming }),
  });

  const { screen } = await renderWithQuery(<RouterProvider router={router} />);

  await screen.getByRole('button', { name: 'qux' }).click();

  const link = screen.getByRole('link', { name: 'foo bar baz' });

  await expect.element(link).toBeVisible();

  const words = [...link.element().querySelectorAll('span > span')].map(
    (word) => [word.textContent, getComputedStyle(word).animationDelay]
  );

  expect({
    row: getComputedStyle(link.element().closest('li') ?? document.body)
      .animationName,
    words,
  }).toEqual({
    row: 'title-wash',
    words: [
      ['foo', '0s'],
      ['bar', '0.03s'],
      ['baz', '0.06s'],
    ],
  });
});

function Finishing() {
  const [running, setRunning] = useState(true);

  return (
    <>
      <Button onClick={() => setRunning(false)}>qux</Button>
      <ul>
        {[1, 2, 3, 4, 5, 6, 7].map((id) => (
          <ConversationItem
            key={id}
            conversation={{
              id,
              pinned: false,
              projectId: null,
              running,
              title: 'foo',
              unread: !running,
              waiting: false,
            }}
            selected={false}
          />
        ))}
      </ul>
    </>
  );
}

function marks() {
  return [
    ...document.querySelectorAll<HTMLElement>(
      '[data-slot=list-row-status] > [data-slot]'
    ),
  ].map((mark) => [
    mark.dataset.slot,
    mark.dataset.state,
    mark.style.getPropertyValue('--live-mark-delay'),
  ]);
}

test('chats that finish in the background hand their marks over to dots, six at a time', async () => {
  const router = createRouter({
    history: createMemoryHistory(),
    routeTree: createRootRoute({ component: Finishing }),
  });

  const { screen } = await renderWithQuery(<RouterProvider router={router} />);

  const seen: ReturnType<typeof marks>[] = [];

  const observer = new MutationObserver(() => seen.push(marks()));

  observer.observe(document.body, {
    attributes: true,
    childList: true,
    subtree: true,
  });

  await screen.getByRole('button', { name: 'qux' }).click();

  await expect
    .poll(marks, { timeout: 5_000 })
    .toEqual(Array.from({ length: 7 }, () => ['dot', undefined, '']));

  observer.disconnect();

  expect(
    seen.find((rows) => rows.some(([, state]) => state === 'handoff'))
  ).toEqual([
    ['live-mark', 'handoff', '0s'],
    ['live-mark', 'handoff', '0.03s'],
    ['live-mark', 'handoff', '0.06s'],
    ['live-mark', 'handoff', '0.09s'],
    ['live-mark', 'handoff', '0.12s'],
    ['live-mark', 'handoff', '0.15s'],
    ['dot', undefined, ''],
  ]);
});

test('leaving a rename returns focus to the chat’s options', async () => {
  stubFetch(() => new Response(null, { status: 204 }));

  const router = createRouter({
    history: createMemoryHistory(),
    routeTree: createRootRoute({
      component: () => (
        <ul>
          <ConversationItem
            conversation={{
              id: 1,
              pinned: false,
              projectId: null,
              running: false,
              title: 'foo',
              unread: false,
              waiting: false,
            }}
            selected={false}
          />
        </ul>
      ),
    }),
  });

  const { screen } = await renderWithQuery(<RouterProvider router={router} />);

  await screen.getByRole('button', { name: 'Options for foo' }).click();
  await screen.getByRole('menuitem', { name: 'Rename' }).click();

  await expect
    .element(screen.getByRole('textbox', { name: 'Chat title' }))
    .toHaveFocus();

  await userEvent.keyboard('{Escape}');

  await expect
    .element(screen.getByRole('button', { name: 'Options for foo' }))
    .toHaveFocus();
});

test('undoing an undone move puts the chat back in the project', async () => {
  const fetch = stubFetch(({ pathname }) => {
    if (pathname === '/api/projects') {
      return Response.json({
        projects: [{ chats: 0, id: 7, instructions: '', name: 'bar' }],
      });
    }

    return new Response(null, { status: 204 });
  });

  const toasts = await render(<Toaster />);

  const router = createRouter({
    history: createMemoryHistory(),
    routeTree: createRootRoute({
      component: () => (
        <ul>
          <ConversationItem
            conversation={{
              id: 1,
              pinned: false,
              projectId: null,
              running: false,
              title: 'foo',
              unread: false,
              waiting: false,
            }}
            selected={false}
          />
        </ul>
      ),
    }),
  });

  const { screen } = await renderWithQuery(<RouterProvider router={router} />);

  await screen.getByRole('button', { name: 'Options for foo' }).click();
  await screen.getByRole('menuitem', { name: 'Move to project' }).click();
  await screen.getByRole('menuitem', { name: 'bar' }).click();

  const undo = (text: string) =>
    toasts
      .getByRole('listitem')
      .filter({ hasText: text })
      .getByRole('button', { name: 'Undo' })
      .click();

  await expect.element(toasts.getByText('Moved to bar.')).toBeVisible();

  await screen.unmount();

  await undo('Moved to bar.');

  await expect.element(toasts.getByText('Removed from project.')).toBeVisible();

  await undo('Removed from project.');

  await expect
    .poll(() =>
      fetch.mock.calls.flatMap(([input, init]) =>
        init?.method === 'PATCH'
          ? [[requestUrl(input).pathname, init.body]]
          : []
      )
    )
    .toEqual([
      ['/api/conversations/1', JSON.stringify({ projectId: 7 })],
      ['/api/conversations/1', JSON.stringify({ projectId: null })],
      ['/api/conversations/1', JSON.stringify({ projectId: 7 })],
    ]);
});

type Landing = 'leaves' | 'moves' | 'stays';

function Pinning({ landing }: { landing: Landing }) {
  const chat = useQuery({
    queryKey: [...conversationsQueryKey, 'foo'],
    queryFn: async () => pinned,
  });

  const item = (
    <ConversationItem
      conversation={{
        id: 1,
        pinned: chat.data ?? false,
        projectId: 7,
        running: false,
        title: 'foo',
        unread: false,
        waiting: false,
      }}
      selected={false}
    />
  );

  const lists = {
    leaves: [false, chat.data === false],
    moves: [chat.data === true, chat.data === false],
    stays: [chat.data === true, true],
  }[landing];

  return (
    <>
      <Button data-project-row={7}>bar</Button>
      {lists.map((shown, index) => (
        <ul key={index}>{shown && item}</ul>
      ))}
    </>
  );
}

let pinned = false;

async function focused(landing: Landing) {
  pinned = false;

  const router = createRouter({
    history: createMemoryHistory(),
    routeTree: createRootRoute({
      component: () => <Pinning landing={landing} />,
    }),
  });

  const { screen } = await renderWithQuery(<RouterProvider router={router} />);

  screen.getByRole('button', { name: 'Options for foo' }).element().focus();

  await userEvent.keyboard('{Enter}');

  await expect
    .element(screen.getByRole('menuitem', { name: 'Pin' }))
    .toHaveFocus();

  await userEvent.keyboard('{Enter}');

  await expect.poll(() => pinned).toBe(true);

  await new Promise((resolve) => setTimeout(resolve, 500));

  const active = document.activeElement;

  const place =
    active?.closest('ul') ?? active?.closest('[data-project-row]') ?? active;

  const places = [...document.querySelectorAll('[data-project-row], ul')];

  await screen.unmount();

  return places.indexOf(place ?? document.body);
}

test('pinning a chat from its row moves focus to where the chat lands', async () => {
  stubFetch((_, init) => {
    pinned ||= init?.method === 'PATCH';
    return new Response(null, { status: 204 });
  });

  expect([
    await focused('moves'),
    await focused('stays'),
    await focused('leaves'),
  ]).toEqual([1, 2, 0]);
});
