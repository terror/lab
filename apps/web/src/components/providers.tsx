import { LoadError } from '@/components/load-error';
import { ProviderLogo } from '@/components/provider-logo';
import { SettingsPage } from '@/components/settings-page';
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
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { modelsQueryOptions } from '@/lib/models';
import {
  type Method,
  type Provider,
  connectProvider,
  providersQueryOptions,
  removeProviderKey,
} from '@/lib/providers';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { type SubmitEvent, useState } from 'react';

function kindGroups(providers: readonly Provider[]) {
  return [
    ...new Map(
      providers.map(({ kind, kindLabel }) => [kind, { kind, label: kindLabel }])
    ).values(),
  ];
}

const methodLabels: Record<Method, string> = {
  api_key: 'API key',
};

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
  const [method, setMethod] = useState<Method>('api_key');
  const [values, setValues] = useState<Record<string, string>>({});

  const provider = providers.find(({ id }) => id === selected);
  const methods = provider?.methods ?? [];

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
            <Field>
              <FieldLabel htmlFor='provider'>Provider</FieldLabel>
              <Select
                disabled={initial !== undefined}
                onValueChange={(value) => {
                  setSelected(value);
                  setValues({});
                }}
                value={selected}
              >
                <SelectTrigger className='w-full' id='provider'>
                  <SelectValue placeholder='Choose a provider' />
                </SelectTrigger>
                <SelectContent>
                  {kindGroups(providers).map(({ kind, label }) => (
                    <SelectGroup key={kind}>
                      <SelectLabel>{label}</SelectLabel>
                      {providers
                        .filter((candidate) => candidate.kind === kind)
                        .map(({ id, name }) => (
                          <SelectItem key={id} value={id}>
                            <ProviderLogo id={id} name={name} size='sm' />
                            {name}
                          </SelectItem>
                        ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {provider && methods.length > 1 && (
              <Field>
                <FieldLabel htmlFor='method'>Connect with</FieldLabel>
                <Select
                  onValueChange={(value) => {
                    const next = methods.find(
                      (candidate) => candidate === value
                    );

                    if (next) {
                      setMethod(next);
                    }
                  }}
                  value={method}
                >
                  <SelectTrigger className='w-full' id='method'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {methods.map((option) => (
                      <SelectItem key={option} value={option}>
                        {methodLabels[option]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
            {provider && method === 'api_key' && (
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

  const remove = useMutation({
    mutationFn: () => removeProviderKey(provider.id),
    onSuccess: refresh,
  });

  return (
    <li className='flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-muted/50'>
      <ProviderLogo id={provider.id} name={provider.name} />
      <div className='flex min-w-0 flex-col'>
        <span className='truncate text-sm font-medium'>{provider.name}</span>
        <span className='truncate text-xs text-muted-foreground'>
          {methodLabels.api_key}
        </span>
      </div>
      <div className='ml-auto flex shrink-0 items-center gap-1'>
        <Button
          aria-label={`Remove ${provider.name}`}
          disabled={remove.isPending}
          onClick={() => remove.mutate()}
          size='sm'
          variant='ghost'
        >
          Remove
        </Button>
        <Button
          aria-label={`Edit ${provider.name}`}
          onClick={onEdit}
          size='sm'
          variant='secondary'
        >
          Edit
        </Button>
      </div>
    </li>
  );
}

export function Providers() {
  const providers = useQuery(providersQueryOptions);
  const [dialog, setDialog] = useState<{ initial?: string; key: number }>();

  const all = providers.data ?? [];
  const connected = all.filter(({ configured }) => configured);

  const open = (initial?: string) => setDialog({ initial, key: Date.now() });

  return (
    <SettingsPage
      action={
        <Button onClick={() => open()} size='sm'>
          <Plus aria-hidden='true' />
          Add provider
        </Button>
      }
      description='Connect the services Lab uses for models, web search, and its computer.'
      title='Providers'
    >
      {providers.isError && <LoadError subject='providers' />}
      {providers.isSuccess && connected.length === 0 && (
        <p className='text-sm text-muted-foreground'>
          No providers are connected yet.
        </p>
      )}
      <ul className='-mx-3 flex flex-col'>
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
    </SettingsPage>
  );
}
