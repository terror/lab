import { renderWithQuery } from '@/test/helpers';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router';
import { expect, test } from 'vitest';

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
