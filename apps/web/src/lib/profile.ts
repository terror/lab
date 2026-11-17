import { queryOptions, useQuery } from '@tanstack/react-query';

import { authClient } from './auth';
import { call, client } from './client';
import { useRefreshMutation } from './mutations';

const profileQueryOptions = queryOptions({
  queryKey: ['profile'],
  queryFn: ({ signal }) =>
    call(client.profile.$get(undefined, { init: { signal } })),
  staleTime: Infinity,
});

export function useAdmin() {
  return useQuery(profileQueryOptions).data?.admin === true;
}

export function usePictureUpdate<T>(
  mutationFn: (value: T) => Promise<unknown>
) {
  const session = authClient.useSession();

  return useRefreshMutation(mutationFn, {
    inlineError: true,
    onSuccess: () => session.refetch(),
  });
}

export function setPicture(picture: File) {
  return call(client.profile.picture.$put({ form: { picture } }));
}

export function removePicture() {
  return call(client.profile.picture.$delete());
}

export const exportUrl = client.profile.export.$url().pathname;

export function deleteAccount() {
  return call(client.profile.$delete());
}
