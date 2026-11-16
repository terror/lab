import { queryOptions } from '@tanstack/react-query';
import type { InferResponseType } from 'hono/client';
import { z } from 'zod';

import { call, client } from './client';
import { usePersistentState } from './storage';

function fetchVersion({ signal }: { signal: AbortSignal }) {
  return call(client.version.$get(undefined, { init: { signal } }));
}

export const loadedVersionQueryOptions = queryOptions({
  queryKey: ['version', 'loaded'],
  queryFn: fetchVersion,
  staleTime: Infinity,
});

export const latestVersionQueryOptions = queryOptions({
  queryKey: ['version', 'latest'],
  queryFn: fetchVersion,
  refetchInterval: 60_000,
  refetchOnWindowFocus: true,
  staleTime: 0,
});

export type ChangelogEntry = InferResponseType<
  typeof client.changelog.$get,
  200
>['entries'][number];

export function changelogQueryOptions(since: string) {
  return queryOptions({
    queryKey: ['changelog', since],
    queryFn: ({ signal }) =>
      call(client.changelog.$get({ query: { since } }, { init: { signal } })),
    staleTime: Infinity,
  });
}

const seenSchema = z.string().optional();

export function useSeenVersion() {
  return usePersistentState('seen-version', seenSchema, undefined);
}
