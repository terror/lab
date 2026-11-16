import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { modelsQueryOptions } from '@/lib/models';
import {
  providersQueryOptions,
  removeProviderKey,
  saveProviderKey,
} from '@/lib/providers';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type SubmitEvent, useState } from 'react';

type Provider = {
  configured: boolean;
  id: string;
  name: string;
  stored: boolean;
};

function status({ configured, stored }: Provider) {
  if (stored) {
    return 'Connected';
  }

  return configured ? 'From environment' : undefined;
}

function ProviderRow({ provider }: { provider: Provider }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [key, setKey] = useState('');

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: providersQueryOptions.queryKey,
      }),
      queryClient.invalidateQueries({ queryKey: modelsQueryOptions.queryKey }),
    ]);
  };

  const save = useMutation({
    meta: { inlineError: true },
    mutationFn: () => saveProviderKey(provider.id, key),
    onSuccess: async () => {
      setEditing(false);
      setKey('');
      await refresh();
    },
  });

  const remove = useMutation({
    mutationFn: () => removeProviderKey(provider.id),
    onSuccess: refresh,
  });

  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    save.mutate();
  };

  const label = status(provider);

  return (
    <li className='flex flex-col gap-3 py-3'>
      <div className='flex items-center gap-3'>
        <span className='text-sm font-medium'>{provider.name}</span>
        {label && (
          <span className='text-xs text-muted-foreground'>{label}</span>
        )}
        <div className='ml-auto flex items-center gap-1'>
          {provider.stored && (
            <Button
              aria-label={`Remove ${provider.name} key`}
              disabled={remove.isPending}
              onClick={() => remove.mutate()}
              size='sm'
              variant='ghost'
            >
              Remove
            </Button>
          )}
          {!editing && (
            <Button
              aria-label={`${provider.stored ? 'Replace' : 'Add'} ${provider.name} key`}
              onClick={() => setEditing(true)}
              size='sm'
              variant='outline'
            >
              {provider.stored ? 'Replace key' : 'Add key'}
            </Button>
          )}
        </div>
      </div>
      {editing && (
        <form className='flex flex-col gap-2' onSubmit={onSubmit}>
          <div className='flex items-center gap-2'>
            <Input
              aria-label={`${provider.name} API key`}
              autoComplete='off'
              ref={(element) => element?.focus()}
              onChange={(event) => setKey(event.target.value)}
              placeholder='API key'
              type='password'
              value={key}
            />
            <Button
              disabled={!key.trim() || save.isPending}
              size='sm'
              type='submit'
            >
              Save
            </Button>
            <Button
              onClick={() => {
                setEditing(false);
                setKey('');
              }}
              size='sm'
              type='button'
              variant='ghost'
            >
              Cancel
            </Button>
          </div>
          {save.error && (
            <p role='alert' className='text-sm text-destructive'>
              {save.error.message}
            </p>
          )}
        </form>
      )}
    </li>
  );
}

export function Providers() {
  const providers = useQuery(providersQueryOptions);

  const sorted = (providers.data ?? []).toSorted(
    (a, b) => Number(b.configured) - Number(a.configured)
  );

  return (
    <section className='space-y-6'>
      <div className='space-y-1'>
        <h1 className='text-2xl font-semibold tracking-tight'>Providers</h1>
        <p className='text-sm text-muted-foreground'>
          Add an API key to use a provider’s models.
        </p>
      </div>
      {providers.isError && (
        <p role='alert' className='text-sm text-destructive'>
          Unable to load providers.
        </p>
      )}
      <ul className='divide-y'>
        {sorted.map((provider) => (
          <ProviderRow key={provider.id} provider={provider} />
        ))}
      </ul>
    </section>
  );
}
