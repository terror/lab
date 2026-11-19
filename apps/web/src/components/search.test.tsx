import { Toaster } from '@/components/ui/sonner';
import { preferencesQueryOptions } from '@/lib/preferences';
import { queryClient } from '@/lib/query-client';
import { renderWithQuery, requestUrl, stubFetch } from '@/test/helpers';
import { defaultPreferences } from '@lab/server/schemas';
import { QueryClient } from '@tanstack/react-query';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router';
import { expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';

import { SearchProvider } from './search';

const pinned = [{ id: 6, projectId: null, title: 'foo' }];

const recent = Array.from({ length: 6 }, (_, index) => ({
  id: index + 1,
  projectId: null,
  title: 'bar',
}));

function stubWorkspace() {
  return stubFetch(({ pathname, searchParams }, init) => {
    if (init?.method === 'POST') {
      return Response.json({ error: 'bar' }, { status: 400 });
    }

    if (pathname === '/api/projects') {
      return Response.json({
        projects: Array.from({ length: 6 }, (_, index) => ({
          chats: 0,
          id: index + 7,
          instructions: '',
          name: 'baz',
        })),
      });
    }

    if (pathname === '/api/conversations') {
      const lists: Record<string, typeof recent> = { all: recent, pinned };

      return Response.json({
        conversations: lists[searchParams.get('filter') ?? ''] ?? [],
        next: null,
      });
    }

    return Response.json({
      chats: [],
      default: null,
      files: [],
      models: [],
      projects: [],
      schedules: [],
    });
  });
}

async function openSearch(client?: QueryClient) {
  const router = createRouter({
    history: createMemoryHistory(),
    routeTree: createRootRoute({
      component: () => <SearchProvider>{null}</SearchProvider>,
    }),
  });

  const { screen } = await renderWithQuery(
    <>
      <RouterProvider router={router} />
      <Toaster />
    </>,
    client
  );

  await userEvent.keyboard('{Meta>}k{/Meta}');

  return { router, screen };
}

function hints() {
  return document.querySelector('[cmdk-root] > :last-child')?.textContent;
}

function values() {
  return [...document.querySelectorAll('[cmdk-item]')].map((item) =>
    item.getAttribute('data-value')
  );
}

test('an empty query lists chats, places to go, and actions', async () => {
  stubWorkspace();

  await openSearch();

  await expect
    .poll(values)
    .toEqual([
      'recent-6',
      'recent-1',
      'recent-2',
      'recent-3',
      'recent-4',
      'go-library',
      'go-scheduled',
      'go-trash',
      'go-settings',
      'go-project-7',
      'go-project-8',
      'go-project-9',
      'go-project-10',
      'go-project-11',
      'new-chat',
      'new-project',
      'theme',
    ]);

  expect(hints()).toBe('↑↓navigate↵openescclose');
});

test('a query lists the places to go whose title matches it', async () => {
  stubWorkspace();

  const { router, screen } = await openSearch();

  await screen.getByRole('combobox', { name: 'Search Lab' }).fill('trash');

  await expect.poll(values).toEqual(['go-trash', 'ask']);

  expect(hints()).toBe('↑↓navigate↵open⇥scope⌘↵ask Labescclose');

  await userEvent.keyboard('{Enter}');

  await expect
    .poll(() => ({
      pathname: router.state.location.pathname,
      search: router.state.location.search,
    }))
    .toEqual({ pathname: '/settings', search: { section: 'trash' } });
});

test('a query without matches says so instead of showing scopes', async () => {
  stubWorkspace();

  const { screen } = await openSearch();

  await screen.getByRole('combobox', { name: 'Search Lab' }).fill('foo');

  await expect.element(screen.getByText('No matches for “foo”.')).toBeVisible();
  await expect
    .element(screen.getByRole('group', { name: 'Scope' }))
    .not.toBeInTheDocument();

  expect(values()).toEqual(['ask']);
  expect(hints()).toBe('↑↓navigate↵open⌘↵ask Labescclose');
});

test('a failed search says so instead of reporting no matches', async () => {
  stubFetch(() => new Response(null, { status: 500 }));

  const { screen } = await openSearch(
    new QueryClient({ defaultOptions: { queries: { retry: false } } })
  );

  await screen.getByRole('combobox', { name: 'Search Lab' }).fill('foo');

  await expect
    .element(screen.getByText('Couldn’t search for “foo”.'))
    .toBeVisible();

  expect(screen.getByText('No matches for “foo”.').query()).toBeNull();
});

test('asking Lab right after typing asks about the whole query', async () => {
  const fetch = stubWorkspace();

  const { screen } = await openSearch(queryClient);

  const input = screen
    .getByRole('combobox', { name: 'Search Lab' })
    .element() as HTMLInputElement;

  Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value'
  )?.set?.call(input, 'foo');
  input.dispatchEvent(new Event('input', { bubbles: true }));

  await Promise.resolve();

  input.dispatchEvent(
    new KeyboardEvent('keydown', { bubbles: true, key: 'Enter', metaKey: true })
  );

  await expect.element(screen.getByText('bar')).toBeVisible();

  expect(
    fetch.mock.calls.flatMap(([, init]) =>
      init?.method === 'POST' ? [init.body] : []
    )
  ).toEqual([JSON.stringify({ attachments: [], content: 'foo' })]);
});

test('the search box points at the selected result', async () => {
  stubWorkspace();

  const { screen } = await openSearch();

  const input = screen.getByRole('combobox', { name: 'Search Lab' });

  await input.fill('trash');

  await expect.poll(values).toEqual(['go-trash', 'ask']);

  await userEvent.keyboard('{ArrowDown}');

  const selected = screen.getByRole('option', { selected: true });

  await expect.element(selected).toHaveAttribute('data-value', 'ask');
  await expect
    .element(input)
    .toHaveAttribute('aria-activedescendant', selected.element().id);
});

test('opening search counts the palette as tried', async () => {
  const fetch = stubWorkspace();

  const client = new QueryClient();

  client.setQueryData(preferencesQueryOptions.queryKey, defaultPreferences);

  await openSearch(client);

  await expect
    .poll(() =>
      fetch.mock.calls.flatMap(([input, init]) =>
        requestUrl(input).pathname === '/api/preferences/hints'
          ? [init?.body]
          : []
      )
    )
    .toEqual([JSON.stringify({ id: 'palette' })]);
});
