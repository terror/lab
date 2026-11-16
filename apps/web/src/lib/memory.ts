import { queryOptions } from '@tanstack/react-query';
import type { InferResponseType } from 'hono/client';

import { call, client } from './client';

export type MemoryState = InferResponseType<typeof client.memory.$get, 200>;

export const memoryQueryOptions = queryOptions({
  queryKey: ['memory'],
  queryFn: ({ signal }) =>
    call(client.memory.$get(undefined, { init: { signal } })),
});

export function saveInstructions(instructions: string) {
  return call(client.memory.instructions.$put({ json: { instructions } }));
}

export function addMemory(text: string) {
  return call(client.memory.$post({ json: { text } }));
}

export function removeMemory(id: string) {
  return call(client.memory[':id'].$delete({ param: { id } }));
}
