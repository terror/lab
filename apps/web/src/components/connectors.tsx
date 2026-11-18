import { ConfirmDialog } from '@/components/confirm-dialog';
import { LoadError } from '@/components/load-error';
import { SettingsPage } from '@/components/settings-page';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
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
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  type Connector,
  type ConnectorFields,
  connectorsQueryOptions,
  createConnector,
  deleteConnector,
  reconnectConnector,
  setConnectorEnabled,
  useConnectorsUpdate,
} from '@/lib/connectors';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Ellipsis, Plus } from 'lucide-react';
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
    error: ({ error }) => error ?? "Couldn't connect",
    off: () => 'Off',
    unauthorized: () => 'Sign in to use this connector',
  };

function Status({ connector }: { connector: Connector }) {
  const status = statuses[connector.status](connector);

  if (connector.status === 'error') {
    return <p className='text-sm text-destructive'>{status}</p>;
  }

  if (connector.tools.length === 0) {
    return <p className='text-sm text-muted-foreground'>{status}</p>;
  }

  return (
    <CollapsibleTrigger className='group flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground'>
      {status}
      <ChevronRight
        aria-hidden='true'
        className='size-3.5 transition-transform group-data-[state=open]:rotate-90'
      />
    </CollapsibleTrigger>
  );
}

function ConnectorRow({ connector }: { connector: Connector }) {
  const toggle = useConnectorsUpdate(setConnectorEnabled);
  const reconnect = useConnectorsUpdate(reconnectConnector);
  const remove = useConnectorsUpdate(deleteConnector);

  const [confirming, setConfirming] = useState(false);

  return (
    <li className='rounded-2xl px-3 py-2.5 transition-colors hover:bg-muted/50'>
      <Collapsible>
        <div className='flex items-center gap-3'>
          <div className='min-w-0 flex-1'>
            <p className='truncate text-sm font-medium'>{connector.name}</p>
            <p className='truncate text-sm text-muted-foreground'>
              {connector.url}
            </p>
            <Status connector={connector} />
          </div>
          {connector.status === 'unauthorized' && (
            <Button asChild size='sm' variant='secondary'>
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                aria-label={`Options for ${connector.name}`}
                size='icon-sm'
                variant='ghost'
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
              <DropdownMenuItem
                onSelect={() => setConfirming(true)}
                variant='destructive'
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <CollapsibleContent>
          <ul className='mt-2 flex flex-col gap-1.5 border-l pl-3'>
            {connector.tools.map((tool) => (
              <li key={tool.name} className='text-sm'>
                <span className='font-mono text-xs'>{tool.name}</span>
                <p className='line-clamp-2 text-muted-foreground'>
                  {tool.description}
                </p>
              </li>
            ))}
          </ul>
        </CollapsibleContent>
      </Collapsible>
      <ConfirmDialog
        action='Delete'
        description={`Lab will disconnect from ${connector.name} and forget its sign-in. This can’t be undone.`}
        onConfirm={() => remove.mutate(connector.id)}
        onOpenChange={setConfirming}
        open={confirming}
        title={`Delete ${connector.name}?`}
      />
    </li>
  );
}

export function Connectors() {
  const connectors = useQuery(connectorsQueryOptions);

  const [adding, setAdding] = useState(false);

  return (
    <SettingsPage
      action={
        <Button onClick={() => setAdding(true)} size='sm'>
          <Plus aria-hidden='true' />
          Add connector
        </Button>
      }
      description='Give Lab tools from remote MCP servers. Lab asks before using a tool that can change something.'
      title='Connectors'
    >
      {connectors.isError && <LoadError subject='connectors' />}
      {connectors.data?.connectors.length === 0 && (
        <p className='text-sm text-muted-foreground'>No connectors yet.</p>
      )}
      {connectors.data && connectors.data.connectors.length > 0 && (
        <ul className='-mx-3 flex flex-col'>
          {connectors.data.connectors.map((connector) => (
            <ConnectorRow key={connector.id} connector={connector} />
          ))}
        </ul>
      )}
      <Dialog onOpenChange={setAdding} open={adding}>
        <DialogContent className='sm:max-w-lg'>
          {adding && <AddConnector onClose={() => setAdding(false)} />}
        </DialogContent>
      </Dialog>
    </SettingsPage>
  );
}
