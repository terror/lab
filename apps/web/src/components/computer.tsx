import { ConfirmDialog } from '@/components/confirm-dialog';
import { LoadError } from '@/components/load-error';
import { SettingRow } from '@/components/setting-row';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ListSkeleton } from '@/components/ui/list-row';
import { PageHeader } from '@/components/ui/page';
import { Pills } from '@/components/ui/pills';
import {
  type ComputerStatus,
  computerQueryOptions,
  useComputerAction,
  useNetworkMode,
} from '@/lib/computer';
import { shortDate } from '@/lib/format';
import { useAdmin } from '@/lib/profile';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
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

const networks: {
  description: string;
  label: string;
  value: ComputerStatus['network'];
}[] = [
  { description: 'Any website or service.', label: 'Full', value: 'full' },
  {
    description:
      'Only package registries such as PyPI, npm, GitHub, and crates.io.',
    label: 'Registries',
    value: 'registries',
  },
  { description: 'No outside connections.', label: 'None', value: 'none' },
];

function NetworkPicker({ value }: { value: ComputerStatus['network'] }) {
  const update = useNetworkMode();

  const current = networks.find((network) => network.value === value);

  return (
    <ul className='flex flex-col gap-0.5'>
      <SettingRow
        control={
          <Pills
            disabled={update.isPending}
            label='Internet access'
            onValueChange={(next) => update.mutate(next)}
            options={networks}
            value={value}
          />
        }
        description={current?.description}
        label='Internet access'
      />
    </ul>
  );
}

function NoComputer() {
  const admin = useAdmin();

  if (!admin) {
    return (
      <EmptyState
        description='Ask your Lab admin to connect a computer provider such as Vercel Sandbox.'
        title='No computer yet'
      />
    );
  }

  return (
    <EmptyState
      action={
        <Button asChild size='sm' variant='outline'>
          <Link search={{ section: 'providers' }} to='/settings'>
            Open Providers
          </Link>
        </Button>
      }
      description='Connect a computer provider such as Vercel Sandbox, and Lab sets one up the first time it needs it.'
      title='No computer yet'
    />
  );
}

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
    return <NoComputer />;
  }

  return (
    <div className='flex flex-col gap-6'>
      <NetworkPicker value={status.network} />
      <div className='flex flex-col gap-3'>
        <Row label='Provider' value={provider} />
        <Row
          label='Status'
          value={computer ? states[computer.state] : 'Not created yet'}
        />
        {computer && (
          <Row label='Created' value={shortDate(computer.createdAt)} />
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
      <ConfirmDialog
        action='Reset'
        description='Every file and installed package on it will be deleted. Lab creates a fresh computer the next time it needs one.'
        onConfirm={() => reset.mutate()}
        onOpenChange={setConfirming}
        open={confirming}
        title='Reset the computer?'
      />
    </div>
  );
}

export function Computer() {
  const status = useQuery(computerQueryOptions);

  return (
    <>
      <PageHeader
        description='A workspace for code and files.'
        title='Computer'
      />
      {status.isPending && <ListSkeleton />}
      {status.isLoadingError && (
        <LoadError onRetry={() => status.refetch()} subject='the computer' />
      )}
      {status.data && <Details status={status.data} />}
    </>
  );
}
