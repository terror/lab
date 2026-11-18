import { imageTypes } from '@lab/server/schemas';
import {
  infiniteQueryOptions,
  keepPreviousData,
  queryOptions,
  useInfiniteQuery,
  useQueries,
} from '@tanstack/react-query';
import type { InferResponseType } from 'hono/client';
import { useEffect, useState } from 'react';

import { call, client } from './client';

export const libraryQueryKey = ['library'];

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
    queryKey: [...libraryQueryKey, kind, search],
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
    error: library.isLoadingError,
    fetchNextPage: library.fetchNextPage,
    hasNextPage: library.hasNextPage,
    items,
    loadMore,
    pageError: library.isFetchNextPageError,
    pending: library.isPending,
    query,
    refetch: library.refetch,
    search,
    setSearch,
  };
}

export function libraryTextQueryOptions(id: number) {
  return queryOptions({
    queryKey: [...libraryQueryKey, 'text', id],
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

const LIBRARY_IMAGE = /lab-image:(\d+)/g;

function libraryImageQueryOptions(id: number) {
  return queryOptions({
    queryKey: ['library-image', id],
    queryFn: async ({ signal }) => {
      const response = await fetch(libraryItemUrl(id), { signal });

      const type = response.headers.get('content-type');

      if (!response.ok || !imageTypes.some((imageType) => imageType === type)) {
        throw new Error('Unable to load image');
      }

      const data = new Uint8Array(await response.arrayBuffer()).toBase64();

      return `data:${type};base64,${data}`;
    },
    retry: false,
    staleTime: Infinity,
  });
}

export function useLibraryImages(html: string) {
  const ids = [
    ...new Set(
      Array.from(html.matchAll(LIBRARY_IMAGE), ([, id]) => Number(id))
    ),
  ];

  const images = useQueries({ queries: ids.map(libraryImageQueryOptions) });

  if (images.some(({ isPending }) => isPending)) {
    return undefined;
  }

  const urls = new Map(ids.map((id, index) => [id, images[index]?.data]));

  return html.replaceAll(
    LIBRARY_IMAGE,
    (reference, id: string) => urls.get(Number(id)) ?? reference
  );
}
