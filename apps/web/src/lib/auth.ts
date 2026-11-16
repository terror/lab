import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient();

export function useUser() {
  const user = authClient.useSession().data?.user;

  if (!user) {
    throw new Error('`useUser` must be used inside a signed-in route');
  }

  return user;
}
