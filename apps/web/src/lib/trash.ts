import { queryOptions, useQueryClient } from '@tanstack/react-query';
import type { InferResponseType } from 'hono/client';

import { call, client } from './client';
import { clearDraft, conversationsQueryKey } from './conversations';
import { invalidateAll, useRefreshMutation } from './mutations';
import { projectsQueryOptions } from './projects';

export type TrashItem = InferResponseType<
  typeof client.trash.$get,
  200
>['items'][number];

type TrashRef = Pick<TrashItem, 'id' | 'kind'>;

const trashQueryKey = ['trash'];

export const trashQueryOptions = queryOptions({
  queryKey: trashQueryKey,
  queryFn: async ({ signal }) =>
    (await call(client.trash.$get(undefined, { init: { signal } }))).items,
});

function param({ id, kind }: TrashRef) {
  return { param: { id: String(id), kind } };
}

export async function restoreFromTrash(item: TrashRef) {
  await call(client.trash[':kind'][':id'].restore.$post(param(item)));
}

export async function deleteForever(item: TrashRef) {
  await call(client.trash[':kind'][':id'].$delete(param(item)));

  if (item.kind === 'conversation') {
    clearDraft(item.id);
  }
}

export async function emptyTrash() {
  await call(client.trash.$delete());
}

const trashedQueryKeys = [
  trashQueryKey,
  conversationsQueryKey,
  projectsQueryOptions.queryKey,
];

export function useTrashAction<T>(mutationFn: (value: T) => Promise<void>) {
  return useRefreshMutation(mutationFn, { invalidate: trashedQueryKeys });
}

export function useUndoTrash() {
  const queryClient = useQueryClient();

  return async (item: TrashRef, then?: () => Promise<void>) => {
    await restoreFromTrash(item);
    await invalidateAll(queryClient, trashedQueryKeys);
    await then?.();
  };
}
