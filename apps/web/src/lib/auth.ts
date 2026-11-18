import type { QueryClient } from '@tanstack/react-query';
import { createAuthClient } from 'better-auth/react';

import { clearStored } from './storage';

export const authClient = createAuthClient({
  fetchOptions: { customFetchImpl: (input, init) => window.fetch(input, init) },
});

export async function signOut(queryClient: QueryClient) {
  const result = await authClient.signOut().catch(() => undefined);

  if (!result || result.error) {
    throw new Error('Couldn’t sign out. Check your connection and try again.');
  }

  clearStored();
  queryClient.clear();
}

export type User = typeof authClient.$Infer.Session.user;

export function useUser(): User {
  const user = authClient.useSession().data?.user;

  if (!user) {
    throw new Error('`useUser` must be used inside a signed-in route');
  }

  return user;
}
