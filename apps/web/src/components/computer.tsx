import { LoadError } from '@/components/load-error';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  type ComputerStatus,
  computerQueryOptions,
  useComputerAction,
} from '@/lib/computer';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

type State = NonNullable<ComputerStatus['computer']>['state'];

const states: Record<State, string> = {
  aborted: 'Stopped',
  failed: 'Failed',
  pending: 'Starting',
  running: 'Running',
  snapshotting: 'Saving',
  stopped: 'Stopped',
  stopping: 'Stopping',
};

const created = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className='flex items-center justify-between gap-4 text-sm'>
      <span className='text-muted-foreground'>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function Details({ status }: { status: ComputerStatus }) {
  const [confirming, setConfirming] = useState(false);

  const stop = useComputerAction('stop');
  const reset = useComputerAction('reset');

  const { computer, provider } = status;

  if (!provider) {
    return (
      <p className='text-sm text-muted-foreground'>
        No computer is set up. Set LAB_SANDBOX_PROVIDER and the provider's
        credentials on the server.
      </p>
    );
  }

  return (
    <div className='flex flex-col gap-6'>
      <div className='flex flex-col gap-3'>
        <Row label='Provider' value={provider} />
        <Row
          label='Status'
          value={computer ? states[computer.state] : 'Not created yet'}
        />
        {computer && (
          <Row
            label='Created'
            value={created.format(new Date(computer.createdAt))}
          />
        )}
      </div>
      <div className='flex gap-2'>
        <Button
          disabled={computer?.state !== 'running' || stop.isPending}
          onClick={() => stop.mutate()}
          size='sm'
          variant='secondary'
        >
          Stop
        </Button>
        <Button
          disabled={!computer || reset.isPending}
          onClick={() => setConfirming(true)}
          size='sm'
          variant='ghost'
        >
          Reset computer
        </Button>
      </div>
      <AlertDialog onOpenChange={setConfirming} open={confirming}>
        <AlertDialogContent size='sm'>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset the computer?</AlertDialogTitle>
            <AlertDialogDescription>
              Every file and installed package on it will be deleted. Lab
              creates a fresh computer the next time it needs one.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => reset.mutate()}
              variant='destructive'
            >
              Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function Computer() {
  const status = useQuery(computerQueryOptions);

  return (
    <section className='space-y-8'>
      <div className='space-y-1'>
        <h1 className='text-2xl font-semibold tracking-tight'>Computer</h1>
        <p className='text-sm text-muted-foreground'>
          A persistent Linux computer Lab uses to run code and work with files.
          Each chat gets its own folder, and it stops on its own when idle.
        </p>
      </div>
      {status.isError && <LoadError subject='the computer' />}
      {status.data && <Details status={status.data} />}
    </section>
  );
}
