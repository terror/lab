import { queryOptions } from '@tanstack/react-query';
import type { InferResponseType } from 'hono/client';

import { call, client } from './client';
import { useRefreshMutation } from './mutations';

export type MemoryState = InferResponseType<typeof client.memory.$get, 200>;

export const memoryQueryOptions = queryOptions({
  queryKey: ['memory'],
  queryFn: ({ signal }) =>
    call(client.memory.$get(undefined, { init: { signal } })),
});

export function updateMemory(json: {
  instructions?: string;
  referenceChats?: boolean;
}) {
  return call(client.memory.$patch({ json }));
}

export function addMemory(text: string) {
  return call(client.memory.$post({ json: { text } }));
}

export function removeMemory(id: string) {
  return call(client.memory[':id'].$delete({ param: { id } }));
}

export function useMemoryUpdate<T>(
  mutationFn: (value: T) => Promise<MemoryState>
) {
  return useRefreshMutation(mutationFn, {
    inlineError: true,
    set: memoryQueryOptions.queryKey,
  });
}
