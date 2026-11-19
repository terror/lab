import { defaultPreferences, preferencesSchema } from '@lab/server/schemas';
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useEffect } from 'react';
import { z } from 'zod';

import { call, client } from './client';
import { readStored, writeStored } from './storage';

export type Preferences = z.infer<typeof preferencesSchema>;

const CACHE = 'preferences';

export const preferencesQueryOptions = queryOptions({
  queryKey: ['preferences'],
  queryFn: async ({ signal }) => ({
    ...defaultPreferences,
    ...(await call(client.preferences.$get(undefined, { init: { signal } })))
      .preferences,
  }),
  placeholderData: () => ({
    ...defaultPreferences,
    ...readStored(CACHE, preferencesSchema.partial(), {}),
  }),
  staleTime: Infinity,
});

export function useStoredPreferences() {
  const { data } = useQuery(preferencesQueryOptions);

  useEffect(() => {
    if (data) {
      writeStored(CACHE, data);
    }
  }, [data]);
}

export function usePreference<K extends keyof Preferences>(key: K) {
  const queryClient = useQueryClient();

  const { data = defaultPreferences } = useQuery(preferencesQueryOptions);

  const save = useMutation({
    mutationFn: (value: Preferences[K]) =>
      call(client.preferences.$patch({ json: { [key]: value } })),
    onMutate: (value) => {
      const next = { ...data, [key]: value };

      queryClient.setQueryData(preferencesQueryOptions.queryKey, next);
    },
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: preferencesQueryOptions.queryKey,
      }),
  });

  return [data[key], (value: Preferences[K]) => save.mutate(value)] as const;
}
