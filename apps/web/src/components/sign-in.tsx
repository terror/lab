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
    <main className='flex min-h-svh items-center justify-center p-6'>
      <div className='flex w-full max-w-sm flex-col items-center gap-6 text-center'>
        <LabMark className='size-10' />
        <div className='space-y-2'>
          <h1 className='text-2xl font-semibold tracking-tight'>
            Sign in to Lab
          </h1>
          {error && (
            <p role='alert' className='text-sm text-destructive'>
              {errors.get(error) ?? 'Unable to sign in. Try again.'}
            </p>
          )}
        </div>
        <Button
          className='w-full'
          disabled={signIn.isPending}
          onClick={() => signIn.mutate()}
          size='lg'
        >
          Continue with Google
        </Button>
      </div>
    </main>
  );
}
