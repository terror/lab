import { LabMark } from '@/components/lab-mark';
import { SessionWorkspace } from '@/components/session-workspace';
import { Button } from '@/components/ui/button';
import { healthQueryOptions } from '@/lib/health';
import { createSession } from '@/lib/sessions';
import { cn } from '@/lib/utils';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';

function currentSession() {
  return new URL(window.location.href).searchParams.get('session');
}

export function App() {
  const health = useQuery(healthQueryOptions);

  const [sessionId, setSessionId] = useState(currentSession);

  useEffect(() => {
    const navigate = () => setSessionId(currentSession());

    window.addEventListener('popstate', navigate);

    return () => window.removeEventListener('popstate', navigate);
  }, []);

  const creating = useMutation({
    mutationFn: createSession,
    onSuccess: (created) => {
      const url = new URL(window.location.href);

      url.searchParams.set('session', created.sessionId);

      window.history.pushState(null, '', url);

      setSessionId(created.sessionId);
    },
  });

  return (
    <div className='min-h-svh bg-background'>
      <header className='border-b'>
        <div className='mx-auto flex h-16 max-w-5xl items-center gap-3 px-6'>
          <a href='/' aria-label='Lab home' className='flex items-center gap-3'>
            <LabMark />
            <span className='text-lg font-semibold tracking-tight'>lab</span>
          </a>

          <p
            role='status'
            className='ml-auto flex items-center gap-2 text-xs text-muted-foreground'
          >
            <span
              aria-hidden='true'
              className={cn(
                'size-2 rounded-full',
                health.isPending
                  ? 'bg-muted-foreground motion-safe:animate-pulse'
                  : health.isError
                    ? 'bg-destructive'
                    : 'bg-emerald-600'
              )}
            />

            <span className='sr-only sm:not-sr-only'>
              {health.isPending
                ? 'Connecting'
                : health.isError
                  ? 'Disconnected'
                  : 'Connected'}
            </span>
          </p>

          <Button
            variant='outline'
            disabled={creating.isPending}
            onClick={() => creating.mutate()}
          >
            <Plus aria-hidden='true' />
            {creating.isPending ? 'Creating' : 'New session'}
          </Button>
        </div>
      </header>

      {creating.error && (
        <p
          role='alert'
          className='mx-auto max-w-3xl px-6 py-3 text-sm text-destructive'
        >
          {creating.error.message}
        </p>
      )}

      {sessionId ? (
        <SessionWorkspace key={sessionId} sessionId={sessionId} />
      ) : (
        <main className='mx-auto max-w-3xl px-6 py-24'>
          <div className='max-w-lg space-y-6'>
            <h1 className='text-3xl font-semibold tracking-tight sm:text-4xl'>
              A place for your agents.
            </h1>

            <p className='leading-relaxed text-muted-foreground'>
              Start a conversation, follow your agent’s progress, and return to
              it whenever you need.
            </p>

            <Button
              disabled={creating.isPending}
              onClick={() => creating.mutate()}
            >
              <Plus aria-hidden='true' />
              {creating.isPending ? 'Creating' : 'Start a session'}
            </Button>
          </div>
        </main>
      )}
    </div>
  );
}
