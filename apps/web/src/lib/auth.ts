import type { QueryClient } from '@tanstack/react-query';
import { createAuthClient } from 'better-auth/react';

import { clearStored } from './storage';

export const authClient = createAuthClient();

export async function signOut(queryClient: QueryClient) {
  await authClient.signOut().catch(() => undefined);

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
