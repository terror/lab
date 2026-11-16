import { LabMark } from '@/components/lab-mark';
import { Button } from '@/components/ui/button';
import {
  type ErrorComponentProps,
  Link,
  useRouter,
} from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';

function details(error: unknown) {
  if (!(error instanceof Error)) {
    return String(error);
  }

  if (import.meta.env.DEV && error.stack) {
    return error.stack;
  }

  return error.message;
}

export function ErrorPage({ error, reset }: ErrorComponentProps) {
  const router = useRouter();

  const retry = () => {
    reset();
    void router.invalidate();
  };

  return (
    <div className='flex min-h-[60svh] flex-1 items-center justify-center px-6 py-12'>
      <div
        className='flex w-full max-w-md animate-in flex-col items-center gap-6 text-center duration-300 fade-in slide-in-from-bottom-2'
        role='alert'
      >
        <LabMark className='size-10' />
        <div className='space-y-2'>
          <h1 className='text-xl font-semibold tracking-tight'>
            Something went wrong
          </h1>
          <p className='text-sm text-balance text-muted-foreground'>
            Lab ran into an unexpected error. Try again, or start a new chat.
          </p>
        </div>
        <div className='flex gap-2'>
          <Button onClick={retry}>Try again</Button>
          <Button asChild variant='ghost'>
            <Link to='/'>New chat</Link>
          </Button>
        </div>
        <details className='group w-full text-sm'>
          <summary className='mx-auto flex w-fit list-none items-center gap-1 text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden'>
            Details
            <ChevronRight
              aria-hidden='true'
              className='size-3.5 transition-transform group-open:rotate-90'
            />
          </summary>
          <pre className='mt-3 max-h-64 overflow-auto rounded-xl bg-muted p-4 text-left font-mono text-xs whitespace-pre-wrap'>
            {details(error)}
          </pre>
        </details>
      </div>
    </div>
  );
}
