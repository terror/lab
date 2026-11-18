import '@/index.css';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/sonner';
import { renderWithQuery, requestUrl, stubFetch } from '@/test/helpers';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router';
import { useState } from 'react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

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
