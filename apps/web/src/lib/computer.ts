import { queryOptions } from '@tanstack/react-query';
import type { InferResponseType } from 'hono/client';

import { call, client } from './client';
import { useRefreshMutation } from './mutations';

export type ComputerStatus = InferResponseType<
  typeof client.computer.$get,
  200
>;

const computerQueryKey = ['computer'];

export const computerQueryOptions = queryOptions({
  queryKey: computerQueryKey,
  queryFn: ({ signal }) =>
    call(client.computer.$get(undefined, { init: { signal } })),
});

export function useNetworkMode() {
  return useRefreshMutation(
    (network: ComputerStatus['network']) =>
      call(client.computer.$patch({ json: { network } })),
    { set: computerQueryKey }
  );
}

export function useComputerAction(action: 'reset' | 'stop') {
  return useRefreshMutation(
    () =>
      call(
        action === 'stop'
          ? client.computer.stop.$post()
          : client.computer.$delete()
      ),
    { invalidate: [computerQueryKey] }
  );
}
