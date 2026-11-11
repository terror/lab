import { queryOptions } from '@tanstack/react-query';
import { z } from 'zod';

const healthSchema = z.object({ status: z.literal('ok') });

export const healthQueryOptions = queryOptions({
  queryKey: ['health'],
  queryFn: async ({ signal }) => {
    const response = await fetch('/api/health', { signal });

    if (!response.ok) {
      throw new Error('Unable to connect to lab');
    }

    return healthSchema.parse(await response.json());
  },
  staleTime: 10_000,
  refetchInterval: 30_000,
  retry: 1,
});
