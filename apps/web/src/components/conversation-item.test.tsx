import { renderWithQuery } from '@/test/helpers';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router';
import { expect, test } from 'vitest';

import { ConversationItem } from './conversation-item';

async function check(selected: boolean, expected: string[]) {
  const router = createRouter({
    history: createMemoryHistory(),
    routeTree: createRootRoute({
      component: () => (
        <ConversationItem
          conversation={{
            id: 1,
            pinned: false,
            projectId: null,
            running: false,
            title: 'foo',
            unread: true,
          }}
          onSelect={() => undefined}
          selected={selected}
        />
      ),
    }),
  });

  const { screen } = await renderWithQuery(<RouterProvider router={router} />);

  await expect
    .element(screen.getByRole('link', { name: /^foo/ }))
    .toHaveAttribute('href', '/c/1');

  expect(
    screen
      .getByText('Unread')
      .elements()
      .map((element) => element.textContent)
  ).toEqual(expected);

  await screen.unmount();
}

test('unread chats are marked unless selected', async () => {
  await check(false, ['Unread']);
  await check(true, []);
});
