import { defaultPreferences, preferencesSchema } from '@lab/server/schemas';
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { z } from 'zod';

import { call, client } from './client';
import { readStored, removeStored, writeStored } from './storage';

export type Preferences = z.infer<typeof preferencesSchema>;

const CACHE = 'preferences';

const LEGACY_KEYS = ['sort', 'line-numbers', 'theme'];

function stored<T>(key: string, schema: z.ZodType<T>) {
  return readStored(key, schema.optional(), undefined);
}

function legacyChange() {
  const { chatSort, lineNumbers, theme } = preferencesSchema.shape;

  const values = {
    chatSort: stored('sort', chatSort),
    lineNumbers: stored('line-numbers', lineNumbers),
    theme: stored('theme', theme),
  };

  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined)
  );
}

async function load(signal: AbortSignal) {
  const change = legacyChange();

  const { preferences } =
    Object.keys(change).length > 0
      ? await call(client.preferences.$patch({ json: change }))
      : await call(client.preferences.$get(undefined, { init: { signal } }));

  for (const key of LEGACY_KEYS) {
    removeStored(key);
  }

  writeStored(CACHE, preferences);

  return preferences;
}

export const preferencesQueryOptions = queryOptions({
  queryKey: ['preferences'],
  queryFn: ({ signal }) => load(signal),
  placeholderData: () => ({
    ...defaultPreferences,
    ...readStored(CACHE, preferencesSchema.partial(), {}),
  }),
  staleTime: Infinity,
});

export function usePreference<K extends keyof Preferences>(key: K) {
  const queryClient = useQueryClient();

  const { data = defaultPreferences } = useQuery(preferencesQueryOptions);

  const save = useMutation({
    mutationFn: (value: Preferences[K]) =>
      call(client.preferences.$patch({ json: { [key]: value } })),
    onMutate: (value) => {
      const next = { ...data, [key]: value };

      queryClient.setQueryData(preferencesQueryOptions.queryKey, next);
      writeStored(CACHE, next);
    },
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: preferencesQueryOptions.queryKey,
      }),
  });

  return [data[key], (value: Preferences[K]) => save.mutate(value)] as const;
}
