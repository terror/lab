import { ConnectionStatus } from '@/components/connection-status';
import { LabMark } from '@/components/lab-mark';
import { SessionWorkspace } from '@/components/session-workspace';
import { Button } from '@/components/ui/button';
import { useCreateSession } from '@/lib/use-create-session';
import { useSessionLocation } from '@/lib/use-session-location';
import { Plus } from 'lucide-react';

export function App() {
  const { sessionId, openSession } = useSessionLocation();

  const { state, create } = useCreateSession(openSession);

  const creating = state.status === 'creating';

  return (
    <div className='flex h-svh flex-col overflow-hidden bg-background'>
      <header className='shrink-0 border-b'>
        <div className='mx-auto flex h-16 max-w-5xl items-center gap-3 px-6'>
          <a href='/' aria-label='Lab home' className='flex items-center gap-3'>
            <LabMark />
            <span className='text-lg font-semibold tracking-tight'>lab</span>
          </a>

          <ConnectionStatus />

          <Button
            variant='outline'
            disabled={creating}
            onClick={() => void create()}
          >
            <Plus aria-hidden='true' />
            {creating ? 'Creating' : 'New session'}
          </Button>
        </div>
      </header>

      {state.status === 'failed' && (
        <p
          role='alert'
          className='mx-auto w-full max-w-3xl shrink-0 px-6 py-3 text-sm text-destructive'
        >
          {state.error.message}
        </p>
      )}

      {sessionId ? (
        <SessionWorkspace key={sessionId} sessionId={sessionId} />
      ) : (
        <main className='mx-auto w-full max-w-3xl flex-1 overflow-y-auto px-6 py-24'>
          <div className='max-w-lg space-y-6'>
            <h1 className='text-3xl font-semibold tracking-tight sm:text-4xl'>
              A place for your agents.
            </h1>

            <p className='leading-relaxed text-muted-foreground'>
              Start a conversation, follow your agent’s progress, and return to
              it whenever you need.
            </p>

            <Button disabled={creating} onClick={() => void create()}>
              <Plus aria-hidden='true' />
              {creating ? 'Creating' : 'Start a session'}
            </Button>
          </div>
        </main>
      )}
    </div>
  );
}
