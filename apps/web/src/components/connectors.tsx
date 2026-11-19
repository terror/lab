import { ConfirmDialog } from '@/components/confirm-dialog';
import { LoadError } from '@/components/load-error';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { ListRow, ListSkeleton } from '@/components/ui/list-row';
import { PageHeader } from '@/components/ui/page';
import { Switch } from '@/components/ui/switch';
import {
  type Connector,
  type ConnectorFields,
  connectorsQueryOptions,
  createConnector,
  deleteConnector,
  reconnectConnector,
  setConnectorEnabled,
  trustConnector,
  useConnectorsUpdate,
} from '@/lib/connectors';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Ellipsis, Plug, Plus } from 'lucide-react';
import { type SubmitEvent, useState } from 'react';

function AddConnector({ onClose }: { onClose: () => void }) {
  const [fields, setFields] = useState<ConnectorFields>({ name: '', url: '' });

  const create = useConnectorsUpdate(createConnector, true);

  const edit = (key: keyof ConnectorFields) => (value: string) =>
    setFields((current) => ({ ...current, [key]: value }));

  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    create.mutate(fields, { onSuccess: onClose });
  };

  return (
    <form
      aria-label='Connector'
      className='flex flex-col gap-6'
      onSubmit={onSubmit}
    >
      <DialogHeader>
        <DialogTitle>Add connector</DialogTitle>
        <DialogDescription>
          Connect a remote MCP server by its URL. If it needs you to sign in,
          Lab will ask after you add it.
        </DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor='connector-name'>Name</FieldLabel>
          <Input
            autoComplete='off'
            data-1p-ignore
            id='connector-name'
            maxLength={64}
            onChange={(event) => edit('name')(event.target.value)}
            value={fields.name}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor='connector-url'>URL</FieldLabel>
          <Input
            autoComplete='off'
            data-1p-ignore
            id='connector-url'
            inputMode='url'
            onChange={(event) => edit('url')(event.target.value)}
            placeholder='https://example.com/mcp'
            value={fields.url}
          />
        </Field>
        {create.error && <FieldError>{create.error.message}</FieldError>}
      </FieldGroup>
      <DialogFooter>
        <Button onClick={onClose} type='button' variant='ghost'>
          Cancel
        </Button>
        <Button
          disabled={
            !fields.name.trim() || !fields.url.trim() || create.isPending
          }
          type='submit'
        >
          {create.isPending ? 'Connecting…' : 'Add'}
        </Button>
      </DialogFooter>
    </form>
  );
}

const statuses: Record<Connector['status'], (connector: Connector) => string> =
  {
    connected: ({ tools }) =>
      `${tools.length} ${tools.length === 1 ? 'tool' : 'tools'}`,
    connecting: () => 'Connecting…',
    error: ({ error }) => error ?? 'Couldn’t connect',
    off: () => 'Off',
    unauthorized: () => 'Sign in to use this connector',
  };

function Status({
  connector,
  onToggle,
  open,
}: {
  connector: Connector;
  onToggle: () => void;
  open: boolean;
}) {
  const status = statuses[connector.status](connector);

  if (connector.status === 'error') {
    return <span className='truncate text-destructive'>{status}</span>;
  }

  if (connector.tools.length === 0) {
    return <span className='truncate text-muted-foreground'>{status}</span>;
  }

  return (
    <Button
      aria-expanded={open}
      className='-ml-2 self-start'
      onClick={onToggle}
      size='sm'
      variant='quiet'
    >
      {status}
      <ChevronRight
        aria-hidden='true'
        className={cn('transition-transform', open && 'rotate-90')}
      />
    </Button>
  );
}

function ConnectorRow({ connector }: { connector: Connector }) {
  const toggle = useConnectorsUpdate(setConnectorEnabled);
  const reconnect = useConnectorsUpdate(reconnectConnector);
  const remove = useConnectorsUpdate(deleteConnector);
  const trust = useConnectorsUpdate(trustConnector);

  const [confirming, setConfirming] = useState(false);
  const [open, setOpen] = useState(false);
  const [trusting, setTrusting] = useState(false);

  const onTrustChange = (readOnly: boolean) => {
    if (readOnly) {
      setTrusting(true);
      return;
    }

    trust.mutate({ id: connector.id, readOnly });
  };

  return (
    <>
      <ListRow
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  aria-label={`Actions for ${connector.name}`}
                  size='icon-sm'
                  variant='quiet'
                >
                  <Ellipsis aria-hidden='true' />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end'>
                <DropdownMenuItem
                  disabled={!connector.enabled}
                  onSelect={() => reconnect.mutate(connector.id)}
                >
                  Reconnect
                </DropdownMenuItem>
                <DropdownMenuCheckboxItem
                  checked={connector.trustReadOnly}
                  disabled={trust.isPending}
                  onCheckedChange={onTrustChange}
                >
                  Trust read-only tools
                </DropdownMenuCheckboxItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => setConfirming(true)}
                  variant='destructive'
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <ConfirmDialog
              action='Delete'
              description={`Lab will disconnect from ${connector.name} and forget its sign-in. This can’t be undone.`}
              onConfirm={() => remove.mutate(connector.id)}
              onOpenChange={setConfirming}
              open={confirming}
              title={`Delete ${connector.name}?`}
            />
            <ConfirmDialog
              action='Trust'
              description={`Lab will use the tools ${connector.name} marks as read-only without asking you first. ${connector.name} decides which of its tools are read-only.`}
              onConfirm={() =>
                trust.mutate({ id: connector.id, readOnly: true })
              }
              onOpenChange={setTrusting}
              open={trusting}
              title={`Trust ${connector.name}’s read-only tools?`}
            />
          </>
        }
      >
        <Plug
          aria-hidden='true'
          className='size-4 shrink-0 text-muted-foreground'
        />
        <span className='flex min-w-0 flex-1 flex-col'>
          <span className='truncate font-medium'>{connector.name}</span>
          <span className='truncate text-muted-foreground'>
            {connector.url}
          </span>
          <Status
            connector={connector}
            onToggle={() => setOpen(!open)}
            open={open}
          />
        </span>
        {connector.status === 'unauthorized' && (
          <Button asChild size='sm' variant='outline'>
            <a href={`/api/connectors/${connector.id}/authorize`}>Sign in</a>
          </Button>
        )}
        <Switch
          aria-label={`Use ${connector.name}`}
          checked={connector.enabled}
          disabled={toggle.isPending}
          onCheckedChange={(enabled) =>
            toggle.mutate({ enabled, id: connector.id })
          }
        />
      </ListRow>
      {open && (
        <li className='pb-2 pl-7'>
          <ul className='flex flex-col gap-1.5 border-l pl-3'>
            {connector.tools.map((tool) => (
              <li key={tool.name} className='text-sm'>
                <span className='font-mono text-xs'>{tool.name}</span>
                {tool.readOnly && (
                  <span className='ml-2 text-xs text-muted-foreground'>
                    Read-only
                  </span>
                )}
                <p className='line-clamp-2 text-muted-foreground'>
                  {tool.description}
                </p>
              </li>
            ))}
          </ul>
        </li>
      )}
    </>
  );
}

export function Connectors() {
  const connectors = useQuery(connectorsQueryOptions);

  const [adding, setAdding] = useState(false);

  return (
    <>
      <PageHeader
        actions={
          <Button onClick={() => setAdding(true)} size='sm'>
            <Plus aria-hidden='true' />
            Add connector
          </Button>
        }
        description='Tools from other services.'
        title='Connectors'
      />
      {connectors.isPending && <ListSkeleton />}
      {connectors.isLoadingError && (
        <LoadError onRetry={() => connectors.refetch()} subject='connectors' />
      )}
      {connectors.data?.connectors.length === 0 && (
        <EmptyState
          description='Add a remote MCP server by its URL to give Lab its tools.'
          title='No connectors yet'
        />
      )}
      <ul className='flex flex-col gap-0.5'>
        {connectors.data?.connectors.map((connector) => (
          <ConnectorRow key={connector.id} connector={connector} />
        ))}
      </ul>
      <Dialog onOpenChange={setAdding} open={adding}>
        <DialogContent className='sm:max-w-lg'>
          {adding && <AddConnector onClose={() => setAdding(false)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
