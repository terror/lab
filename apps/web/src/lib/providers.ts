import { queryOptions } from '@tanstack/react-query';
import type { InferRequestType, InferResponseType } from 'hono/client';

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

export type Provider = InferResponseType<
  typeof client.providers.$get,
  200
>['providers'][number];

export type Connection = InferRequestType<
  (typeof client.providers)[':id']['$put']
>['json'];

export async function connectProvider(id: string, connection: Connection) {
  await call(client.providers[':id'].$put({ json: connection, param: { id } }));
}

export async function removeProviderKey(id: string) {
  await call(client.providers[':id'].$delete({ param: { id } }));
}
