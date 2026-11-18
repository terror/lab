import { ConfirmDialog } from '@/components/confirm-dialog';
import { LoadError } from '@/components/load-error';
import { SettingsPage } from '@/components/settings-page';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  type ComputerStatus,
  computerQueryOptions,
  useComputerAction,
  useNetworkMode,
} from '@/lib/computer';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react';
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
    label: 'Package registries',
    value: 'registries',
  },
  { description: 'No outside connections.', label: 'None', value: 'none' },
];

function NetworkPicker({ value }: { value: ComputerStatus['network'] }) {
  const update = useNetworkMode();

  const current = networks.find((network) => network.value === value);

  return (
    <div className='flex items-start justify-between gap-6'>
      <div className='space-y-1'>
        <p className='text-sm font-medium'>Internet access</p>
        <p className='text-sm text-muted-foreground'>{current?.description}</p>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className='flex shrink-0 items-center gap-1 rounded-control text-sm text-muted-foreground'
            disabled={update.isPending}
            type='button'
          >
            {current?.label}
            <ChevronDown aria-hidden='true' className='size-4' />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end'>
          <DropdownMenuRadioGroup
            onValueChange={(next) => {
              const choice = networks.find((network) => network.value === next);

              if (choice) {
                update.mutate(choice.value);
              }
            }}
            value={value}
          >
            {networks.map(({ label, value: option }) => (
              <DropdownMenuRadioItem key={option} value={option}>
                {label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

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
        No computer is set up. Connect a computer provider such as Vercel
        Sandbox in Providers.
      </p>
    );
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
    <SettingsPage
      description={
        'A persistent Linux computer Lab uses to run code and work with files. Each chat gets its own folder, and it stops on its own when idle.'
      }
      title='Computer'
    >
      {status.isError && <LoadError subject='the computer' />}
      {status.data && <Details status={status.data} />}
    </SettingsPage>
  );
}
