import { preferencesQueryOptions } from '@/lib/preferences';
import { renderWithQuery, stubFetch } from '@/test/helpers';
import { defaultPreferences } from '@lab/server/schemas';
import { QueryClient } from '@tanstack/react-query';
import { expect, test } from 'vitest';

import { useDocumentTitle } from './title';

function Title() {
  useDocumentTitle('foo');

  return null;
}

function hide(hidden: boolean) {
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    get: () => hidden,
  });

  document.dispatchEvent(new Event('visibilitychange'));
}

function tab() {
  const href =
    document.querySelector('link[rel=icon]')?.getAttribute('href') ?? '';

  return [
    document.title,
    decodeURIComponent(href.replace('data:image/svg+xml,', '')),
  ];
}

const chat = {
  finishedAt: '2026-01-01T00:00:00.000Z',
  id: 1,
  preview: 'bar',
  scheduled: false,
  title: 'baz',
};

const working = { chats: [], running: 1, waiting: [] };

const mark = (color: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><mask id="m"><rect width="32" height="32" fill="#fff"/><rect x="18" width="14" height="14"/></mask><g mask="url(#m)"><path d="M10 2H22V6H20V14H24V18H8V14H12V6H10Z" fill="#f09082"/><path d="M8 18H16V26H26V30H6V26H2V22H6V18Z" fill="#4d9abf"/><path d="M16 18H26V22H30V26H16Z" fill="#f1be58"/></g><rect x="20" width="12" height="12" fill="${color}"/></svg>`;

async function arrive(before: object, after: object, away: string[]) {
  const link = document.createElement('link');

  link.rel = 'icon';
  link.href = '/favicon.svg';
  document.head.append(link);

  let unread = before;

  const fetch = stubFetch(() => Response.json(unread));

  fetch.mockClear();

  hide(true);

  const client = new QueryClient();

  client.setQueryData(preferencesQueryOptions.queryKey, defaultPreferences);

  const { screen } = await renderWithQuery(<Title />, client);

  await expect.poll(() => fetch.mock.calls.length).toBe(1);

  unread = after;

  await expect.poll(() => fetch.mock.calls.length, { timeout: 3_000 }).toBe(2);
  await expect.poll(tab).toEqual(away);

  hide(false);

  await expect.poll(tab).toEqual(['foo', '/favicon.svg']);

  await screen.unmount();

  Reflect.deleteProperty(document, 'hidden');
  link.remove();
}

test('the tab marks a chat that finished or needs you while it was hidden', async () => {
  const waiting = { chats: [], running: 1, waiting: [{ id: 2, title: 'baz' }] };

  await arrive(working, { chats: [chat], running: 0, waiting: [] }, [
    'Done · foo',
    mark('#f1be58'),
  ]);

  await arrive(working, waiting, ['Needs you · foo', mark('#f09082')]);

  await arrive(waiting, { ...waiting, chats: [chat] }, [
    'Done · foo',
    mark('#f1be58'),
  ]);

  await arrive(waiting, waiting, ['Needs you · foo', mark('#f09082')]);

  await arrive(
    { chats: [chat], running: 1, waiting: [] },
    { chats: [chat], running: 1, waiting: [] },
    ['foo', '/favicon.svg']
  );
});
