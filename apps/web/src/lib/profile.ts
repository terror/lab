import { authClient } from './auth';
import { call, client } from './client';
import { useRefreshMutation } from './mutations';

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
