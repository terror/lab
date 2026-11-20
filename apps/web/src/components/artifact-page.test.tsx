import { artifactIdParam } from '@/lib/artifacts';
import {
  fetchedPaths,
  renderWithQuery,
  requestUrl,
  stubFetch,
} from '@/test/helpers';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { expect, test } from 'vitest';

import { ArtifactPage } from './artifact-page';

function renderPage(artifactId: string, version = 1, pinned = true) {
  const state = { failing: false };

  const fetch = stubFetch(({ pathname }) => {
    if (state.failing) {
      return Response.json({ error: 'foo' }, { status: 502 });
    }

    if (pathname === '/api/projects') {
      return Response.json({
        projects: [{ chats: 0, id: 7, instructions: '', name: 'foo' }],
      });
    }

    if (pathname === '/api/conversations/pins') {
      return Response.json({
        pins: pinned
          ? [
              {
                artifactId: 'bar',
                conversationId: 1,
                projectId: 7,
                seenVersion: 1,
                title: 'baz',
                version,
              },
            ]
          : [],
      });
    }

    if (pathname === '/api/conversations/1/artifacts/bar') {
      return Response.json({ content: '<p>foo</p>', title: 'baz', version });
    }

    if (pathname.startsWith('/api/conversations/1/artifacts/bar/pin')) {
      return new Response(null, { status: 204 });
    }

    return Response.json({ error: 'Conversation not found' }, { status: 404 });
  });

  const root = createRootRoute();

  const chat = createRoute({ getParentRoute: () => root, id: 'chat' });

  const page = createRoute({
    component: ArtifactPage,
    getParentRoute: () => chat,
    params: {
      parse: (params) => ({
        artifactId: artifactIdParam(params.artifactId),
        conversationId: Number(params.conversationId),
      }),
    },
    path: '/apps/$conversationId/$artifactId',
  });

  const router = createRouter({
    history: createMemoryHistory({
      initialEntries: [`/apps/1/${artifactId}`],
    }),
    routeTree: root.addChildren([chat.addChildren([page])]),
  });

  return {
    fetch,
    rendered: renderWithQuery(<RouterProvider router={router} />),
    state,
  };
}

test('a pinned app opens as a page that moves or drops its pin', async () => {
  const { fetch, rendered } = renderPage('bar');

  const { screen } = await rendered;

  await expect
    .element(screen.getByRole('heading', { name: 'baz' }))
    .toBeVisible();
  await expect.element(screen.getByTitle('baz')).toBeInTheDocument();
  await expect
    .element(screen.getByRole('link', { name: 'Open chat' }))
    .toHaveAttribute('href', '/c/1');

  await screen.getByRole('button', { name: 'Pinned' }).click();

  await expect
    .element(screen.getByRole('menuitemradio', { name: 'foo' }))
    .toHaveAttribute('aria-checked', 'true');

  await screen.getByRole('menuitemradio', { name: 'Sidebar' }).click();

  await screen.getByRole('button', { name: 'Pinned' }).click();

  await screen.getByRole('menuitem', { name: 'Unpin' }).click();

  await expect
    .poll(() =>
      fetch.mock.calls.flatMap(([input, init]) =>
        init?.method === 'PUT' || init?.method === 'DELETE'
          ? [[init.method, requestUrl(input).pathname, init.body]]
          : []
      )
    )
    .toEqual([
      ['PUT', '/api/conversations/1/artifacts/bar/pin', '{"projectId":null}'],
      ['DELETE', '/api/conversations/1/artifacts/bar/pin', undefined],
    ]);
});

test('an open app stays when a refresh fails', async () => {
  const { rendered, state } = renderPage('bar');

  const { client, screen } = await rendered;

  await expect
    .element(screen.getByRole('heading', { name: 'baz' }))
    .toBeVisible();

  state.failing = true;

  await client.refetchQueries();
  await new Promise((resolve) => setTimeout(resolve, 100));

  await expect
    .element(screen.getByRole('heading', { name: 'baz' }))
    .toBeVisible();
  await expect
    .element(screen.getByText('This app isn’t available'))
    .not.toBeInTheDocument();
});

test('an app from a deleted chat is unavailable', async () => {
  const { rendered } = renderPage('qux');

  const { screen } = await rendered;

  await expect
    .element(screen.getByText('This app isn’t available'))
    .toBeVisible();
  await expect
    .element(screen.getByRole('link', { name: 'Open Trash' }))
    .toHaveAttribute('href', '/settings?section=trash');
});

test('an app link whose id is not an artifact id fetches nothing', async () => {
  const { fetch, rendered } = renderPage('..%2F..%2Ffoo%3F');

  const { screen } = await rendered;

  await expect.element(screen.getByText('Not Found')).toBeVisible();

  expect(fetchedPaths(fetch)).toEqual([]);
});

test('an app updated since it was last opened shows its new version and is marked seen', async () => {
  const { fetch, rendered } = renderPage('bar', 2);

  const { screen } = await rendered;

  await expect
    .poll(() => screen.getByRole('banner').element().textContent)
    .toBe('bazv2');

  await expect
    .poll(() =>
      fetch.mock.calls.flatMap(([input, init]) =>
        init?.method === 'POST' ? [requestUrl(input).pathname] : []
      )
    )
    .toEqual(['/api/conversations/1/artifacts/bar/pin/seen']);
});

test('an unpinned app shows its version without rolling up to it', async () => {
  const texts: (string | null)[] = [];

  const observer = new MutationObserver(() =>
    texts.push(document.querySelector('header')?.textContent ?? null)
  );

  observer.observe(document.body, {
    characterData: true,
    childList: true,
    subtree: true,
  });

  const { fetch, rendered } = renderPage('bar', 2, false);

  const { screen } = await rendered;

  await expect
    .poll(() => screen.getByRole('banner').element().textContent)
    .toBe('bazv2');

  observer.disconnect();

  expect({
    posts: fetch.mock.calls.filter(([, init]) => init?.method === 'POST'),
    rolled: texts.some((text) => text?.includes('v0') || text?.includes('v1')),
  }).toEqual({ posts: [], rolled: false });
});
