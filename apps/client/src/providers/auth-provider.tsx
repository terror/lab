import { authClient } from '@/lib/auth';
import { type ReactNode, createContext } from 'react';

export const AuthContext = createContext<ReturnType<
  typeof authClient.useSession
> | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const session = authClient.useSession();

  return <AuthContext value={session}>{children}</AuthContext>;
}
