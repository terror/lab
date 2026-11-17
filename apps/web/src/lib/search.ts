import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { InferResponseType } from 'hono/client';

import { call, client } from './client';

export type SearchResults = InferResponseType<typeof client.search.$get, 200>;

export type Segment = SearchResults['chats'][number]['snippet'] extends
  | (infer S)[]
  | null
  ? S
  : never;

export function useWorkspaceSearch(query: string) {
  return useQuery({
    enabled: query.length > 0,
    placeholderData: keepPreviousData,
    queryKey: ['search', query],
    queryFn: ({ signal }) =>
      call(client.search.$get({ query: { q: query } }, { init: { signal } })),
  });
}

const HOUR = 3_600_000;

const DAY = 24 * HOUR;

const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short' });

const date = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'short',
});

export function ago(value: string, now = Date.now()) {
  const elapsed = now - new Date(value).getTime();

  if (elapsed < HOUR) {
    return `${Math.max(1, Math.round(elapsed / 60_000))}m`;
  }

  if (elapsed < DAY) {
    return `${Math.round(elapsed / HOUR)}h`;
  }

  if (elapsed < 2 * DAY) {
    return 'Yesterday';
  }

  if (elapsed < 7 * DAY) {
    return weekday.format(new Date(value));
  }

  return date.format(new Date(value));
}
