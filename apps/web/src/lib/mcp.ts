import { queryOptions } from '@tanstack/react-query';
import type { InferResponseType } from 'hono/client';

import { call, client } from './client';
import { useRefreshMutation } from './mutations';

export type Key = InferResponseType<
  typeof client.mcp.keys.$get,
  200
>['keys'][number];

export const mcpUrl = `${window.location.origin}/api/mcp`;

export function connectCommand(key: string) {
  return `claude mcp add --transport http lab ${mcpUrl} --header "Authorization: Bearer ${key}"`;
}

export const keysQueryOptions = queryOptions({
  queryKey: ['mcp-keys'],
  queryFn: async ({ signal }) =>
    (await call(client.mcp.keys.$get(undefined, { init: { signal } }))).keys,
});

export async function createKey(name: string) {
  return (await call(client.mcp.keys.$post({ json: { name } }))).key;
}

export async function revokeKey(id: string) {
  await call(client.mcp.keys[':id'].$delete({ param: { id } }));
}

export function useKeysUpdate<T, R>(
  mutationFn: (value: T) => Promise<R>,
  inlineError = false
) {
  return useRefreshMutation(mutationFn, {
    inlineError,
    invalidate: [keysQueryOptions.queryKey],
  });
}
