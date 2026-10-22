import { LabMark } from '@/components/lab-mark';
import { Button } from '@/components/ui/button';
import { useSignIn } from '@/hooks/use-sign-in';
import { ArrowUpRight, LoaderCircle } from 'lucide-react';

export function SignIn() {
  const { pending, signIn } = useSignIn();

  return (
    <div className='flex min-h-svh flex-col bg-background'>
      <header className='flex items-center gap-2.5 px-6 py-5 sm:px-10'>
        <LabMark className='size-7' />
        <span className='text-xl font-semibold tracking-tight'>lab</span>
      </header>
      <main className='flex flex-1 items-center justify-center px-6 pb-24'>
        <div className='w-full max-w-sm text-center'>
          <Button
            className='mt-9 h-12 w-full gap-3 rounded-xl bg-foreground text-background hover:bg-foreground/90'
            disabled={pending}
            onClick={() => void signIn()}
          >
            {pending ? (
              <LoaderCircle className='motion-safe:animate-spin' />
            ) : (
              <svg
                aria-hidden='true'
                viewBox='0 0 24 24'
                className='size-4'
                fill='currentColor'
              >
                <path d='M21.6 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.4a4.7 4.7 0 0 1-2 3.1v2.6h3.3c1.9-1.7 2.9-4.3 2.9-7.6ZM12 22c2.7 0 5-.9 6.7-2.4l-3.3-2.6c-.9.6-2 .9-3.4.9a6 6 0 0 1-5.7-4.2H2.9v2.7A10 10 0 0 0 12 22ZM6.3 13.7a6 6 0 0 1 0-3.4V7.6H2.9a10 10 0 0 0 0 8.8l3.4-2.7ZM12 6.1c1.5 0 2.8.5 3.8 1.5l2.9-2.9A9.6 9.6 0 0 0 12 2a10 10 0 0 0-9.1 5.6l3.4 2.7A6 6 0 0 1 12 6.1Z' />
              </svg>
            )}
            Continue with Google
            <ArrowUpRight className='ml-auto opacity-60' />
          </Button>
          <p className='mt-4 text-xs text-muted-foreground'>
            Sign in with your invited Google account.
          </p>
        </div>
      </main>
    </div>
  );
}
