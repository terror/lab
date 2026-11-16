import {
  infiniteQueryOptions,
  keepPreviousData,
  queryOptions,
  useInfiniteQuery,
} from '@tanstack/react-query';
import type { InferResponseType } from 'hono/client';

import { call, client } from './client';

export type LibraryItem = InferResponseType<
  typeof client.library.$get,
  200
>['items'][number];

export type LibraryKind = LibraryItem['kind'];

export function libraryItemUrl(id: number, download = false) {
  return client.library[':id'].$url({
    param: { id: String(id) },
    query: download ? { download: '1' } : {},
  }).href;
}

function libraryQueryOptions(
  kind: LibraryKind | undefined,
  search: string | undefined
) {
  return infiniteQueryOptions({
    queryKey: ['library', kind, search],
    queryFn: ({ pageParam, signal }) =>
      call(
        client.library.$get(
          { query: { cursor: pageParam?.toString(), kind, search } },
          { init: { signal } }
        )
      ),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: ({ next }) => next ?? undefined,
    placeholderData: keepPreviousData,
    select: ({ pages }) => pages.flatMap(({ items }) => items),
  });
}

export function useLibrary(
  kind: LibraryKind | undefined,
  search: string | undefined
) {
  return useInfiniteQuery(libraryQueryOptions(kind, search));
}

export function libraryTextQueryOptions(id: number) {
  return queryOptions({
    queryKey: ['library', 'text', id],
    queryFn: async ({ signal }) => {
      const response = await fetch(libraryItemUrl(id), { signal });

      if (!response.ok) {
        throw new Error('Unable to load file');
      }

      return response.text();
    },
    staleTime: Infinity,
  });
}
