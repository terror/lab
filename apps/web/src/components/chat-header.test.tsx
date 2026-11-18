import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { queryClient } from '@/lib/query-client';
import { renderWithQuery, requestUrl, stubFetch } from '@/test/helpers';
import type { QueryClient } from '@tanstack/react-query';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router';
import { expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';

import { ChatHeader } from './chat-header';

async function renderHeader(
  title: string | null,
  pinned: boolean,
  client?: QueryClient
) {
  const fetch = stubFetch(({ pathname, searchParams }) => {
    if (pathname === '/api/trash/conversation/1/restore') {
      return Response.json({ error: 'Not in the trash' }, { status: 404 });
    }

    if (pathname === '/api/conversations/1') {
      return Response.json({
        forks: [],
        id: 1,
        projectId: 7,
        running: false,
        title,
      });
    }

    if (pathname === '/api/projects') {
      return Response.json({
        projects: [{ chats: 1, id: 7, instructions: '', name: 'bar' }],
      });
    }

    if (searchParams.get('filter') === 'pinned') {
      return Response.json({
        conversations: pinned
          ? [
              {
                id: 1,
                pinned: true,
                projectId: 7,
                running: false,
                title,
                unread: false,
                waiting: false,
              },
            ]
          : [],
        next: null,
      });
    }

    return new Response(null, { status: 204 });
  });

  const router = createRouter({
    history: createMemoryHistory({ initialEntries: ['/c/1'] }),
    routeTree: createRootRoute({
      component: () => (
        <TooltipProvider>
          <ChatHeader id={1} />
          <Toaster />
        </TooltipProvider>
      ),
    }),
  });

  const { screen } = await renderWithQuery(
    <RouterProvider router={router} />,
    client
  );

  return { fetch, screen };
}

async function read(title: string | null, pinned: boolean) {
  const { screen } = await renderHeader(title, pinned);

  const pin = screen.getByRole('button', { name: pinned ? 'Unpin' : 'Pin' });

  await expect.element(screen.getByRole('link', { name: 'bar' })).toBeVisible();
  await expect.element(pin).toBeVisible();

  const shown = {
    heading: screen.getByRole('heading').element().textContent,
    pressed: pin.element().getAttribute('aria-pressed'),
    project: screen.getByRole('link').element().getAttribute('href'),
  };

  await screen.unmount();

  return shown;
}

test('the chat header shows the title, project and pin state', async () => {
  expect([await read('foo', true), await read(null, false)]).toEqual([
    { heading: 'foo', pressed: 'true', project: '/projects/7' },
    { heading: 'Untitled chat', pressed: 'false', project: '/projects/7' },
  ]);
});

test('the chat header renames the chat from its menu', async () => {
  const { fetch, screen } = await renderHeader('foo', false);

  await expect.element(screen.getByRole('heading')).toHaveTextContent('foo');

  await screen.getByRole('button', { name: 'Chat options' }).click();
  await screen.getByRole('menuitem', { name: 'Rename' }).click();

  await expect
    .element(screen.getByRole('textbox', { name: 'Chat title' }))
    .toHaveFocus();

  await userEvent.keyboard('baz{Enter}');

  await expect
    .poll(() =>
      fetch.mock.calls
        .filter(([, init]) => init?.method === 'PATCH')
        .map(([input, init]) => [requestUrl(input).pathname, init?.body])
    )
    .toEqual([['/api/conversations/1', JSON.stringify({ title: 'baz' })]]);
});

test('an undo that fails says why', async () => {
  const { screen } = await renderHeader('foo', false, queryClient);

  await screen.getByRole('button', { name: 'Chat options' }).click();
  await screen.getByRole('menuitem', { name: 'Delete' }).click();
  await screen.getByRole('button', { name: 'Undo' }).click();

  await expect.element(screen.getByText('Not in the trash')).toBeVisible();
});
