import { queryOptions } from '@tanstack/react-query';

import { call, client } from './client';

export type Visibility = 'private' | 'shared' | 'family';

export const usersQueryOptions = queryOptions({
  queryKey: ['users'],
  queryFn: async ({ signal }) => {
    const { users } = await call(
      client.users.$get(undefined, { init: { signal } })
    );

    return users;
  },
});

export function sharingQueryOptions(id: number) {
  return queryOptions({
    queryKey: ['conversations', id, 'sharing'],
    queryFn: ({ signal }) =>
      call(
        client.conversations[':id'].sharing.$get(
          { param: { id: String(id) } },
          { init: { signal } }
        )
      ),
  });
}

export async function updateSharing(
  id: number,
  sharing: { members: string[]; visibility: Visibility }
) {
  await call(
    client.conversations[':id'].sharing.$put({
      param: { id: String(id) },
      json: sharing,
    })
  );
}
