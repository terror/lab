import { queryOptions } from '@tanstack/react-query';
import type { InferResponseType } from 'hono/client';

import { call, client } from './client';

export type Usage = InferResponseType<typeof client.usage.$get, 200>;

export function usageQueryOptions(days: number) {
  return queryOptions({
    queryKey: ['usage', days],
    queryFn: ({ signal }) =>
      call(
        client.usage.$get(
          { query: { days: String(days) } },
          { init: { signal } }
        )
      ),
  });
}

export type Budget = InferResponseType<typeof client.usage.budget.$get, 200>;

export const budgetQueryOptions = queryOptions({
  queryKey: ['usage', 'budget'],
  queryFn: ({ signal }) =>
    call(client.usage.budget.$get(undefined, { init: { signal } })),
  refetchInterval: 300_000,
});

export function setBudget(limit: number | null) {
  return call(client.usage.budget.$put({ json: { limit } }));
}

export function budgetLevel({ limit, spent }: Budget) {
  if (limit === null) {
    return undefined;
  }

  if (spent >= limit) {
    return 'over';
  }

  return spent >= limit * 0.8 ? 'near' : undefined;
}
