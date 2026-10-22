import { authClient } from '@/lib/auth';
import { ApiError, notifyError, requestError } from '@/lib/errors';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export function useSignIn() {
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const url = new URL(location.href);
    const code = url.searchParams.get('error');

    if (!code) {
      return;
    }

    notifyError(
      new Error(
        'We couldn’t sign you in. Please try again with your invited Google account.'
      ),
      { id: 'sign-in' }
    );

    url.searchParams.delete('error');
    url.searchParams.delete('error_description');

    history.replaceState(history.state, '', url);
  }, []);

  async function signIn() {
    setPending(true);

    toast.dismiss('sign-in');

    try {
      const result = await authClient.signIn
        .social({
          provider: 'google',
          callbackURL: location.href,
          errorCallbackURL: location.origin,
        })
        .catch((error) => {
          throw requestError(error);
        });

      if (result.error) {
        throw new ApiError(result.error.status, result.error.message);
      }
    } catch (error) {
      notifyError(error, { id: 'sign-in' });

      setPending(false);
    }
  }

  return { pending, signIn };
}
