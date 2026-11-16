import { GoogleLogo } from '@/components/google-logo';
import { LabMark } from '@/components/lab-mark';
import { Button } from '@/components/ui/button';
import { authClient } from '@/lib/auth';
import { useMutation } from '@tanstack/react-query';

const errors = new Map([
  ['not_allowed', 'This account is not allowed to use Lab.'],
]);

export function SignIn() {
  const error = new URLSearchParams(window.location.search).get('error');

  const signIn = useMutation({
    mutationFn: () =>
      authClient.signIn.social({
        provider: 'google',
        callbackURL: '/',
        errorCallbackURL: '/',
      }),
  });

  return (
    <main className='flex min-h-svh items-center justify-center bg-background p-6'>
      <div className='flex w-full max-w-sm animate-in flex-col items-center gap-8 px-8 py-10 text-center duration-500 fade-in slide-in-from-bottom-2'>
        <h1 className='sr-only'>Sign in to Lab</h1>
        <LabMark className='size-12' />
        <div className='flex w-full flex-col gap-3'>
          <Button
            className='h-11 w-full gap-3 rounded-xl'
            disabled={signIn.isPending}
            onClick={() => signIn.mutate()}
            variant='secondary'
          >
            <GoogleLogo className='size-5' />
            Continue with Google
          </Button>
          {error && (
            <p role='alert' className='text-sm text-destructive'>
              {errors.get(error) ?? 'Unable to sign in. Try again.'}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
