import {
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import type { InferResponseType } from 'hono/client';

import { call, client } from './client';

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
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (network: ComputerStatus['network']) =>
      call(client.computer.$patch({ json: { network } })),
    onSuccess: (status) => queryClient.setQueryData(computerQueryKey, status),
  });
}

export function useComputerAction(action: 'reset' | 'stop') {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      call(
        action === 'stop'
          ? client.computer.stop.$post()
          : client.computer.$delete()
      ),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: computerQueryKey }),
  });
}
