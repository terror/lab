import { useAuth } from '@/hooks/use-auth';
import { authClient } from '@/lib/auth';
import { ApiError, notifyError, requestError } from '@/lib/errors';
import { useQueryScope } from '@/providers/query-provider';
import { useState } from 'react';
import { toast } from 'sonner';

export function useSignOut() {
  const auth = useAuth();
  const { signal } = useQueryScope();

  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);

    toast.dismiss('sign-out');

    try {
      const result = await authClient.signOut().catch((error) => {
        throw requestError(error);
      });

      if (result.error) {
        throw new ApiError(result.error.status, result.error.message);
      }

      if (!signal.aborted) {
        history.replaceState(null, '', location.pathname);
      }

      await auth.refetch();
    } catch (error) {
      if (!signal.aborted) {
        notifyError(error, { id: 'sign-out' });
      }
    } finally {
      if (!signal.aborted) {
        setPending(false);
      }
    }
  }

  return { pending, signOut };
}
