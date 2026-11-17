import { useMutation } from '@tanstack/react-query';

import { authClient } from './auth';
import { call, client } from './client';

export function usePictureUpdate<T>(
  mutationFn: (value: T) => Promise<unknown>
) {
  const session = authClient.useSession();

  return useMutation({
    meta: { inlineError: true },
    mutationFn,
    onSuccess: () => session.refetch(),
  });
}

export function setPicture(picture: File) {
  return call(client.profile.picture.$put({ form: { picture } }));
}

export function removePicture() {
  return call(client.profile.picture.$delete());
}
