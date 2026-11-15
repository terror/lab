import { queryOptions } from '@tanstack/react-query';

import { call, client } from './client';

export const modelsQueryOptions = queryOptions({
  queryKey: ['models'],
  queryFn: async ({ signal }) => {
    const { models } = await call(
      client.models.$get(undefined, { init: { signal } })
    );

    return models;
  },
  staleTime: Infinity,
});

export async function setConversationModel(id: number, model: string) {
  await call(
    client.conversations[':id'].model.$put({
      param: { id: String(id) },
      json: { id: model },
    })
  );
}
