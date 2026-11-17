import { renderWithQuery, requestUrl, stubFetch } from '@/test/helpers';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router';
import { expect, test } from 'vitest';

import { UnreadChips } from './unread-chips';

function chat(id: number) {
  return {
    finishedAt: new Date().toISOString(),
    id,
    preview: 'bar',
    scheduled: false,
    title: `foo ${id}`,
  };
}

test('finished chats show as chips that can be marked read', async () => {
  const fetch = stubFetch(({ pathname }) =>
    pathname === '/api/conversations/unread'
      ? Response.json({ chats: [1, 2, 3, 4].map(chat), running: 2 })
      : new Response(null, { status: 204 })
  );

  const router = createRouter({
    history: createMemoryHistory(),
    routeTree: createRootRoute({ component: UnreadChips }),
  });

  const { screen } = await renderWithQuery(<RouterProvider router={router} />);

  const list = screen.getByRole('list', {
    name: 'Finished while you were away',
  });

  await expect
    .element(list)
    .toHaveTextContent('foo 11mfoo 21mfoo 31m+12 running');

  await screen.getByRole('button', { name: 'Mark foo 1 as read' }).click();

  await expect
    .poll(() =>
      fetch.mock.calls
        .filter(([, init]) => init?.method === 'POST')
        .map(([input]) => requestUrl(input).pathname)
    )
    .toEqual(['/api/conversations/1/read']);
});
