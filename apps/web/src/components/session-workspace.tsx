import { Button } from '@/components/ui/button';
import { useSession } from '@/lib/use-session';

import { SessionNotice, SessionStatus } from './session-activity';
import { SessionComposer } from './session-composer';
import { SessionTranscript } from './session-transcript';

export function SessionWorkspace({ sessionId }: { sessionId: string }) {
  const { state, send, stop, retry } = useSession(sessionId);

  switch (state.status) {
    case 'loading':
      return (
        <main className='mx-auto w-full max-w-3xl flex-1 px-6 py-16'>
          <p role='status' className='text-muted-foreground'>
            Loading session…
          </p>
        </main>
      );

    case 'unavailable':
      return (
        <main className='mx-auto w-full max-w-3xl flex-1 space-y-4 px-6 py-16'>
          <p role='alert' className='text-destructive'>
            {state.error.message}
          </p>

          {retry && (
            <Button variant='outline' onClick={retry}>
              Try again
            </Button>
          )}
        </main>
      );

    case 'ready':
      return (
        <main className='mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col'>
          <div className='flex items-center justify-between border-b px-6 py-4'>
            <h1 className='font-medium'>Session</h1>

            <SessionStatus
              activity={state.activity}
              runStatus={state.view.status}
            />
          </div>

          <SessionTranscript view={state.view} />

          <div className='space-y-3 border-t bg-background px-6 py-4'>
            <SessionNotice activity={state.activity} onRetry={retry} />

            <SessionComposer
              activity={state.activity}
              onSend={send}
              onStop={stop}
            />
          </div>
        </main>
      );

    default:
      return state satisfies never;
  }
}
