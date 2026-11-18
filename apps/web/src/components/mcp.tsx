import { LoadError } from '@/components/load-error';
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
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { shortDate } from '@/lib/format';
import {
  type Key,
  connectCommand,
  createKey,
  keysQueryOptions,
  mcpUrl,
  revokeKey,
  useKeysUpdate,
} from '@/lib/mcp';
import { useQuery } from '@tanstack/react-query';
import { Check, Copy, Plus } from 'lucide-react';
import { type SubmitEvent, useState } from 'react';

function Snippet({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className='flex flex-col gap-1.5'>
      <p className='text-sm font-medium'>{label}</p>
      <div className='flex items-center gap-2 rounded-lg bg-muted py-1 pr-1 pl-3'>
        <code className='min-w-0 flex-1 font-mono text-xs break-all'>
          {text}
        </code>
        <Button
          aria-label={`Copy ${label}`}
          onClick={() => {
            void navigator.clipboard
              .writeText(text)
              .then(() => setCopied(true));
          }}
          size='icon-sm'
          variant='ghost'
        >
          {copied ? <Check aria-hidden='true' /> : <Copy aria-hidden='true' />}
        </Button>
      </div>
    </div>
  );
}

function CreateKey({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('Claude Code');

  const create = useKeysUpdate(createKey, true);

  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    create.mutate(name.trim());
  };

  if (create.data) {
    return (
      <div className='flex flex-col gap-6'>
        <DialogHeader>
          <DialogTitle>Key created</DialogTitle>
          <DialogDescription>
            Copy the key now. Lab won’t show it again. The command adds Lab to
            Claude Code.
          </DialogDescription>
        </DialogHeader>
        <Snippet label='Key' text={create.data} />
        <Snippet label='Command' text={connectCommand(create.data)} />
        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </div>
    );
  }

  return (
    <form
      aria-label='New key'
      className='flex flex-col gap-6'
      onSubmit={onSubmit}
    >
      <DialogHeader>
        <DialogTitle>Create key</DialogTitle>
        <DialogDescription>
          Name the key after the client that will use it.
        </DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor='key-name'>Name</FieldLabel>
          <Input
            autoComplete='off'
            data-1p-ignore
            id='key-name'
            maxLength={32}
            onChange={(event) => setName(event.target.value)}
            value={name}
          />
        </Field>
        {create.error && <FieldError>{create.error.message}</FieldError>}
      </FieldGroup>
      <DialogFooter>
        <Button onClick={onClose} type='button' variant='ghost'>
          Cancel
        </Button>
        <Button disabled={!name.trim() || create.isPending} type='submit'>
          Create
        </Button>
      </DialogFooter>
    </form>
  );
}

function KeyRow({ apiKey }: { apiKey: Key }) {
  const revoke = useKeysUpdate(revokeKey);

  const name = apiKey.name ?? 'Untitled key';

  const used = apiKey.lastRequest
    ? `last used ${shortDate(apiKey.lastRequest)}`
    : 'never used';

  return (
    <li className='flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-muted/50'>
      <div className='min-w-0 flex-1'>
        <p className='truncate text-sm font-medium'>{name}</p>
        <p className='truncate text-sm text-muted-foreground'>
          {apiKey.start}… · Created {shortDate(apiKey.createdAt)}, {used}
        </p>
      </div>
      <Button
        aria-label={`Revoke ${name}`}
        disabled={revoke.isPending}
        onClick={() => revoke.mutate(apiKey.id)}
        size='sm'
        variant='ghost'
      >
        Revoke
      </Button>
    </li>
  );
}

export function Mcp() {
  const keys = useQuery(keysQueryOptions);

  const [creating, setCreating] = useState(false);

  return (
    <SettingsPage
      action={
        <Button onClick={() => setCreating(true)} size='sm'>
          <Plus aria-hidden='true' />
          Create key
        </Button>
      }
      description='Let Claude Code and other MCP clients search your chats, memory, and library, and hand tasks to Lab.'
      title='MCP'
    >
      <Snippet label='URL' text={mcpUrl} />
      <div className='flex flex-col gap-3'>
        <div className='space-y-1'>
          <h2 className='text-sm font-medium'>Keys</h2>
          <p className='text-sm text-muted-foreground'>
            A client sends a key as a bearer token. Revoke a key to disconnect
            its client.
          </p>
        </div>
        {keys.isError && <LoadError subject='keys' />}
        {keys.data?.length === 0 && (
          <p className='text-sm text-muted-foreground'>No keys yet.</p>
        )}
        {keys.data && keys.data.length > 0 && (
          <ul className='-mx-3 flex flex-col'>
            {keys.data.map((apiKey) => (
              <KeyRow key={apiKey.id} apiKey={apiKey} />
            ))}
          </ul>
        )}
      </div>
      <Dialog onOpenChange={setCreating} open={creating}>
        <DialogContent className='sm:max-w-lg'>
          {creating && <CreateKey onClose={() => setCreating(false)} />}
        </DialogContent>
      </Dialog>
    </SettingsPage>
  );
}
