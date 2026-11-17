import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type { InferResponseType } from 'hono/client';

import { call, client } from './client';

export type ScheduledTask = InferResponseType<
  typeof client.schedules.$get,
  200
>['tasks'][number];

export const schedulesQueryOptions = queryOptions({
  queryKey: ['schedules'],
  queryFn: ({ signal }) =>
    call(client.schedules.$get(undefined, { init: { signal } })),
});

const minute: [Intl.RelativeTimeFormatUnit, number] = ['minute', 60_000];

const units: [Intl.RelativeTimeFormatUnit, number][] = [
  ['day', 86_400_000],
  ['hour', 3_600_000],
  minute,
];

export function untilRun(at: string, now = Date.now()) {
  const delta = new Date(at).getTime() - now;

  const [unit, size] = units.find(([, ms]) => Math.abs(delta) >= ms) ?? minute;

  return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
    Math.round(delta / size),
    unit
  );
}

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
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess,
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: schedulesQueryOptions.queryKey,
      }),
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
