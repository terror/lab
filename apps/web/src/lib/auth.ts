import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient();

export type User = typeof authClient.$Infer.Session.user;

export function useUser(): User {
  const user = authClient.useSession().data?.user;

  if (!user) {
    throw new Error('`useUser` must be used inside a signed-in route');
  }

  return user;
}
