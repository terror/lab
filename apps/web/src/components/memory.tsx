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
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  type MemoryState,
  addMemory,
  memoryQueryOptions,
  removeMemory,
  updateMemory,
  useMemoryUpdate,
} from '@/lib/memory';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { type SubmitEvent, useState } from 'react';

function AddMemoryDialog({
  onOpenChange,
  open,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const [text, setText] = useState('');

  const add = useMemoryUpdate(addMemory, true);

  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    add.mutate(text.trim(), {
      onSuccess: () => {
        setText('');
        onOpenChange(false);
      },
    });
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className='sm:max-w-md'>
        <form
          aria-label='New memory'
          className='flex flex-col gap-6'
          onSubmit={onSubmit}
        >
          <DialogHeader>
            <DialogTitle>Add a memory</DialogTitle>
            <DialogDescription>
              Lab keeps this in mind in every chat.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor='memory-text'>Memory</FieldLabel>
              <Textarea
                className='min-h-24'
                id='memory-text'
                maxLength={500}
                onChange={(event) => setText(event.target.value)}
                value={text}
              />
            </Field>
            {add.error && <FieldError>{add.error.message}</FieldError>}
          </FieldGroup>
          <DialogFooter>
            <Button
              onClick={() => onOpenChange(false)}
              type='button'
              variant='ghost'
            >
              Cancel
            </Button>
            <Button disabled={!text.trim() || add.isPending} type='submit'>
              Add
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Memories({ memories }: { memories: MemoryState['memories'] }) {
  const remove = useMemoryUpdate(removeMemory);

  return (
    <div className='flex flex-col gap-3'>
      <div className='space-y-1'>
        <h2 className='text-sm font-medium'>Memories</h2>
        <p className='text-sm text-muted-foreground'>
          Facts Lab remembers across chats. Ask it to remember or forget
          something, or forget them here.
        </p>
      </div>
      {memories.length === 0 && (
        <p className='text-sm text-muted-foreground'>No memories yet.</p>
      )}
      <ul className='-mx-3 flex flex-col'>
        {memories.map(({ id, text: memory }) => (
          <li
            key={id}
            className='flex items-center gap-3 rounded-2xl px-3 py-1.5 transition-colors hover:bg-muted/50'
          >
            <span className='min-w-0 flex-1 text-sm'>{memory}</span>
            <Button
              aria-label={`Forget ${memory}`}
              disabled={remove.isPending}
              onClick={() => remove.mutate(id)}
              size='sm'
              variant='ghost'
            >
              Forget
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReferenceChats({ enabled }: { enabled: boolean }) {
  const update = useMemoryUpdate((referenceChats: boolean) =>
    updateMemory({ referenceChats })
  );

  return (
    <div className='flex items-start justify-between gap-6'>
      <div className='space-y-1'>
        <label className='text-sm font-medium' htmlFor='reference-chats'>
          Reference other chats
        </label>
        <p className='text-sm text-muted-foreground'>
          Let Lab search and read your earlier chats when they would help.
        </p>
      </div>
      <Switch
        checked={enabled}
        disabled={update.isPending}
        id='reference-chats'
        onCheckedChange={(checked) => update.mutate(checked)}
      />
    </div>
  );
}

export function Memory() {
  const memory = useQuery(memoryQueryOptions);

  const [adding, setAdding] = useState(false);

  return (
    <SettingsPage
      action={
        <Button onClick={() => setAdding(true)} size='sm'>
          <Plus aria-hidden='true' />
          Add memory
        </Button>
      }
      description='What Lab remembers about you across chats.'
      title='Memory'
    >
      {memory.isError && <LoadError subject='memory' />}
      {memory.data && (
        <>
          <ReferenceChats enabled={memory.data.referenceChats} />
          <Memories memories={memory.data.memories} />
        </>
      )}
      <AddMemoryDialog onOpenChange={setAdding} open={adding} />
    </SettingsPage>
  );
}
