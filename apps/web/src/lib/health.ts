import { HealthResponse } from '@lab/app-protocol';
import { Value } from '@lab/protocol';
import { queryOptions } from '@tanstack/react-query';

export const healthQueryOptions = queryOptions({
  queryKey: ['health'],
  queryFn: async ({ signal }) => {
    const response = await fetch('/api/health', { signal });

    if (!response.ok) {
      throw new Error('Unable to connect to lab');
    }

    return Value.Parse(HealthResponse, await response.json());
  },
  staleTime: 10_000,
  refetchInterval: 30_000,
  retry: 1,
});
