import { queryOptions } from '@tanstack/react-query';

import { call, client } from './client';

export const accountQueryOptions = queryOptions({
  queryKey: ['account'],
  queryFn: ({ signal }) =>
    call(client.account.$get(undefined, { init: { signal } })),
  staleTime: Infinity,
});

export const membersQueryOptions = queryOptions({
  queryKey: ['members'],
  queryFn: ({ signal }) =>
    call(client.members.$get(undefined, { init: { signal } })),
});

export async function inviteMember(email: string) {
  await call(client.members.invitations.$post({ json: { email } }));
}

export async function revokeInvitation(email: string) {
  await call(
    client.members.invitations[':email'].$delete({ param: { email } })
  );
}

export async function removeMember(id: string) {
  await call(client.members[':id'].$delete({ param: { id } }));
}
