import { ErrorNotice } from '@/components/error-notice';
import { LabMark } from '@/components/lab-mark';
import { SignIn } from '@/components/sign-in';
import { useAuth } from '@/hooks/use-auth';
import { ApiError } from '@/lib/errors';
import { Suspense, lazy } from 'react';

const ChatWorkspace = lazy(() =>
  import('@/components/chat-workspace').then(({ ChatWorkspace }) => ({
    default: ChatWorkspace,
  }))
);

export function App() {
  const auth = useAuth();

  if (auth.isPending) {
    return (
      <div
        className='flex min-h-svh items-center justify-center'
        role='status'
        aria-label='Loading Lab'
      >
        <LabMark className='size-10 motion-safe:animate-pulse' />
      </div>
    );
  }

  if (auth.error) {
    return (
      <div className='flex min-h-svh items-center justify-center p-6'>
        <ErrorNotice
          error={new ApiError(auth.error.status, auth.error.message)}
          onRetry={() => void auth.refetch()}
        />
      </div>
    );
  }

  return auth.data ? (
    <Suspense
      fallback={
        <div
          className='flex min-h-svh items-center justify-center'
          role='status'
          aria-label='Opening workspace'
        >
          <LabMark className='size-10 motion-safe:animate-pulse' />
        </div>
      }
    >
      <ChatWorkspace key={auth.data.user.id} />
    </Suspense>
  ) : (
    <SignIn />
  );
}
