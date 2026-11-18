import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { InferResponseType } from 'hono/client';

import { call, client } from './client';

type SearchResults = InferResponseType<typeof client.search.$get, 200>;

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
