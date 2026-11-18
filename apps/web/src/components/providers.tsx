import { ConfirmDialog } from '@/components/confirm-dialog';
import { LoadError } from '@/components/load-error';
import { ProviderLogo } from '@/components/provider-logo';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
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
import { EmptyState } from '@/components/ui/empty-state';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { ListRow, ListSkeleton } from '@/components/ui/list-row';
import { PageHeader } from '@/components/ui/page';
import { modelsQueryOptions } from '@/lib/models';
import {
  type Provider,
  connectProvider,
  providersQueryOptions,
  removeProviderKey,
} from '@/lib/providers';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ellipsis, Plus } from 'lucide-react';
import { type SubmitEvent, useState } from 'react';

function kindGroups(providers: readonly Provider[]) {
  return [
    ...new Map(
      providers.map(({ kind, kindLabel }) => [kind, { kind, label: kindLabel }])
    ).values(),
  ];
}

function useRefresh() {
  const queryClient = useQueryClient();

  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: providersQueryOptions.queryKey,
      }),
      queryClient.invalidateQueries({ queryKey: modelsQueryOptions.queryKey }),
    ]);
  };
}

function ProviderFields({
  onChange,
  provider,
  values,
}: {
  onChange: (id: string, value: string) => void;
  provider: Provider;
  values: Record<string, string>;
}) {
  return (
    <>
      {provider.fields.map(({ id, label, secret }) => (
        <Field key={id}>
          <FieldLabel htmlFor={`field-${id}`}>{label}</FieldLabel>
          <Input
            autoComplete='off'
            data-1p-ignore={!secret}
            id={`field-${id}`}
            onChange={(event) => onChange(id, event.target.value)}
            placeholder={
              secret
                ? `Paste your ${provider.name} ${label.toLowerCase()}`
                : undefined
            }
            type={secret ? 'password' : 'text'}
            value={values[id] ?? ''}
          />
        </Field>
      ))}
      <FieldDescription>
        Stored encrypted and only used by this server.
      </FieldDescription>
    </>
  );
}

function ProviderPicker({
  editing,
  onChange,
  provider,
  providers,
}: {
  editing: boolean;
  onChange: (id: string | undefined) => void;
  provider: Provider | undefined;
  providers: Provider[];
}) {
  if (provider) {
    return (
      <Field>
        <FieldTitle>Provider</FieldTitle>
        <div className='flex items-center gap-3'>
          <ProviderLogo id={provider.id} name={provider.name} />
          <span className='flex-1 truncate text-sm font-medium'>
            {provider.name}
          </span>
          {!editing && (
            <Button
              onClick={() => onChange(undefined)}
              size='sm'
              type='button'
              variant='quiet'
            >
              Change
            </Button>
          )}
        </div>
      </Field>
    );
  }

  return (
    <Command className='border p-0'>
      <CommandInput
        aria-label='Search providers'
        placeholder='Search providers'
      />
      <CommandList className='max-h-64'>
        <CommandEmpty>No providers match that search.</CommandEmpty>
        {kindGroups(providers).map(({ kind, label }) => (
          <CommandGroup key={kind} heading={label}>
            {providers
              .filter((candidate) => candidate.kind === kind)
              .map(({ configured, id, name }) => (
                <CommandItem
                  key={id}
                  onSelect={() => onChange(id)}
                  value={name}
                >
                  <ProviderLogo id={id} name={name} size='sm' />
                  <span className='flex-1 truncate'>{name}</span>
                  {configured && (
                    <span className='text-xs text-muted-foreground'>
                      Connected
                    </span>
                  )}
                </CommandItem>
              ))}
          </CommandGroup>
        ))}
      </CommandList>
    </Command>
  );
}

function ConnectDialog({
  initial,
  onOpenChange,
  open,
  providers,
}: {
  initial: string | undefined;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  providers: Provider[];
}) {
  const refresh = useRefresh();
  const [selected, setSelected] = useState(initial);
  const [values, setValues] = useState<Record<string, string>>({});

  const provider = providers.find(({ id }) => id === selected);

  const connect = useMutation({
    meta: { inlineError: true },
    mutationFn: () => {
      const { apiKey = '', ...settings } = values;

      return connectProvider(provider?.id ?? '', {
        apiKey,
        method: 'api_key',
        ...(Object.keys(settings).length > 0 && { settings }),
      });
    },
    onSuccess: async () => {
      onOpenChange(false);
      await refresh();
    },
  });

  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    connect.mutate();
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className='sm:max-w-md'>
        <form className='flex flex-col gap-6' onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>
              {initial ? `Edit ${provider?.name}` : 'Connect a provider'}
            </DialogTitle>
            <DialogDescription>
              Lab uses the providers you connect for models, web search, and its
              computer.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <ProviderPicker
              editing={initial !== undefined}
              onChange={(id) => {
                setSelected(id);
                setValues({});
              }}
              provider={provider}
              providers={providers}
            />
            {provider && (
              <ProviderFields
                onChange={(id, value) =>
                  setValues((current) => ({ ...current, [id]: value }))
                }
                provider={provider}
                values={values}
              />
            )}
            {connect.error && <FieldError>{connect.error.message}</FieldError>}
          </FieldGroup>
          <DialogFooter>
            <Button
              onClick={() => onOpenChange(false)}
              type='button'
              variant='ghost'
            >
              Cancel
            </Button>
            <Button
              disabled={
                !provider ||
                provider.fields.some(({ id }) => !values[id]?.trim()) ||
                connect.isPending
              }
              type='submit'
            >
              {initial ? 'Save' : 'Connect'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ConnectedProvider({
  onEdit,
  provider,
}: {
  onEdit: () => void;
  provider: Provider;
}) {
  const refresh = useRefresh();
  const [confirming, setConfirming] = useState(false);

  const remove = useMutation({
    mutationFn: () => removeProviderKey(provider.id),
    onSuccess: refresh,
  });

  return (
    <ListRow
      actions={
        <>
          <Button
            aria-label={`Edit ${provider.name}`}
            onClick={onEdit}
            size='sm'
            variant='quiet'
          >
            Edit
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                aria-label={`Actions for ${provider.name}`}
                size='icon-sm'
                variant='quiet'
              >
                <Ellipsis aria-hidden='true' />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
              <DropdownMenuItem
                disabled={remove.isPending}
                onSelect={() => setConfirming(true)}
                variant='destructive'
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <ConfirmDialog
            action='Delete'
            description={`Lab will delete the saved API key for ${provider.name}. This can’t be undone.`}
            onConfirm={() => remove.mutate()}
            onOpenChange={setConfirming}
            open={confirming}
            title={`Delete ${provider.name}?`}
          />
        </>
      }
    >
      <ProviderLogo id={provider.id} name={provider.name} />
      <span className='flex min-w-0 flex-col'>
        <span className='truncate font-medium'>{provider.name}</span>
        <span className='truncate text-muted-foreground'>API key</span>
      </span>
    </ListRow>
  );
}

export function Providers() {
  const providers = useQuery(providersQueryOptions);
  const [dialog, setDialog] = useState<{ initial?: string; key: number }>();

  const all = providers.data ?? [];
  const connected = all.filter(({ configured }) => configured);

  const open = (initial?: string) => setDialog({ initial, key: Date.now() });

  return (
    <>
      <PageHeader
        actions={
          <Button onClick={() => open()} size='sm'>
            <Plus aria-hidden='true' />
            Add provider
          </Button>
        }
        description='Connect the services Lab uses for models, web search, and its computer.'
        title='Providers'
      />
      {providers.isPending && <ListSkeleton />}
      {providers.isLoadingError && (
        <LoadError onRetry={() => providers.refetch()} subject='providers' />
      )}
      {providers.isSuccess && connected.length === 0 && (
        <EmptyState
          description='Lab needs a model provider before it can answer.'
          title='No providers yet'
        />
      )}
      <ul className='flex flex-col gap-0.5'>
        {connected.map((provider) => (
          <ConnectedProvider
            key={provider.id}
            onEdit={() => open(provider.id)}
            provider={provider}
          />
        ))}
      </ul>
      {dialog && (
        <ConnectDialog
          key={dialog.key}
          initial={dialog.initial}
          onOpenChange={(next) => {
            if (!next) {
              setDialog(undefined);
            }
          }}
          open
          providers={all}
        />
      )}
    </>
  );
}
