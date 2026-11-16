import { queryOptions } from '@tanstack/react-query';

import { call, client } from './client';

export const providersQueryOptions = queryOptions({
  queryKey: ['providers'],
  queryFn: async ({ signal }) => {
    const { providers } = await call(
      client.providers.$get(undefined, { init: { signal } })
    );

    return providers;
  },
});

export async function saveProviderKey(id: string, apiKey: string) {
  await call(client.providers[':id'].$put({ json: { apiKey }, param: { id } }));
}

export async function removeProviderKey(id: string) {
  await call(client.providers[':id'].$delete({ param: { id } }));
}
