import {
  infiniteQueryOptions,
  keepPreviousData,
  queryOptions,
  useInfiniteQuery,
} from '@tanstack/react-query';
import type { InferResponseType } from 'hono/client';
import { useEffect, useState } from 'react';

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

export function libraryOriginalUrl(id: number) {
  return client.library[':id'].original.$url({ param: { id: String(id) } })
    .href;
}

export function libraryThumbnailUrl(id: number) {
  return client.library[':id'].thumbnail.$url({ param: { id: String(id) } })
    .href;
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
          { query: { cursor: pageParam, kind, search } },
          { init: { signal } }
        )
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: ({ next }) => next ?? undefined,
    placeholderData: keepPreviousData,
    select: ({ pages }) => pages.flatMap(({ items }) => items),
  });
}

const SEARCH_DELAY_MS = 200;

function useDebounced(value: string) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), SEARCH_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [value]);

  return debounced;
}

export function useLibrarySearch(kind: LibraryKind | undefined) {
  const [search, setSearch] = useState('');

  const query = useDebounced(search.trim());

  const library = useInfiniteQuery(
    libraryQueryOptions(kind, query || undefined)
  );

  const items = library.data ?? [];

  const loadMore =
    library.hasNextPage && !library.isFetchingNextPage
      ? () => void library.fetchNextPage()
      : undefined;

  return {
    empty:
      library.isSuccess && !library.isPlaceholderData && items.length === 0,
    error: library.isError,
    fetchNextPage: library.fetchNextPage,
    hasNextPage: library.hasNextPage,
    items,
    loadMore,
    query,
    search,
    setSearch,
  };
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
