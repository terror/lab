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
