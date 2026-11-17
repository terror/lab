import {
  type QueryClient,
  type QueryKey,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';

export function invalidateAll(queryClient: QueryClient, queryKeys: QueryKey[]) {
  return Promise.all(
    queryKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey }))
  );
}

export function useRefreshMutation<T = void, R = unknown>(
  mutationFn: (value: T) => Promise<R>,
  {
    inlineError,
    invalidate = [],
    onSuccess,
    set,
  }: {
    inlineError?: boolean;
    invalidate?: QueryKey[];
    onSuccess?: (result: R, queryClient: QueryClient) => unknown;
    set?: QueryKey;
  }
) {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { inlineError },
    mutationFn,
    onSuccess: (result) => {
      if (set) {
        queryClient.setQueryData(set, result);
      }

      return onSuccess?.(result, queryClient);
    },
    onSettled: () => invalidateAll(queryClient, invalidate),
  });
}
