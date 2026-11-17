import { queryOptions, useQuery } from '@tanstack/react-query';
import type { InferResponseType } from 'hono/client';

import { call, client } from './client';
import { useRefreshMutation } from './mutations';

export type ScheduledTask = InferResponseType<
  typeof client.schedules.$get,
  200
>['tasks'][number];

export const schedulesQueryOptions = queryOptions({
  queryKey: ['schedules'],
  queryFn: ({ signal }) =>
    call(client.schedules.$get(undefined, { init: { signal } })),
});

export function useTimezoneReport() {
  useQuery({
    queryKey: ['timezone'],
    queryFn: async () => {
      const { timeZone } = Intl.DateTimeFormat().resolvedOptions();

      await call(
        client.schedules.timezone.$put({ json: { timezone: timeZone } })
      );

      return timeZone;
    },
    staleTime: Infinity,
  });
}

export function useScheduleAction<T, R>(
  mutationFn: (value: T) => Promise<R>,
  onSuccess?: (result: R) => Promise<void>
) {
  return useRefreshMutation(mutationFn, {
    invalidate: [schedulesQueryOptions.queryKey],
    onSuccess,
  });
}

export function setTaskEnabled({
  enabled,
  id,
}: {
  enabled: boolean;
  id: number;
}) {
  return call(
    client.schedules[':id'].$patch({
      json: { enabled },
      param: { id: String(id) },
    })
  );
}

export function runTask(id: number) {
  return call(client.schedules[':id'].run.$post({ param: { id: String(id) } }));
}

export function deleteTask(id: number) {
  return call(client.schedules[':id'].$delete({ param: { id: String(id) } }));
}
