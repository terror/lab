import { LoadError } from '@/components/load-error';
import { SettingRow } from '@/components/setting-row';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { ListRow, ListSkeleton } from '@/components/ui/list-row';
import { PageHeader } from '@/components/ui/page';
import { SectionHeading } from '@/components/ui/section-heading';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  addMemory,
  memoryQueryOptions,
  removeMemory,
  updateMemory,
  useMemoryUpdate,
} from '@/lib/memory';
import { undoToast } from '@/lib/undo';
import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { type SubmitEvent, useState } from 'react';

function MemoryForm({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState('');

  const add = useMemoryUpdate(addMemory, true);

  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    add.mutate(text.trim(), {
      onSuccess: () => {
        setText('');
        onClose();
      },
    });
  };

  return (
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
        <Button onClick={onClose} type='button' variant='ghost'>
          Cancel
        </Button>
        <Button disabled={!text.trim() || add.isPending} type='submit'>
          Add
        </Button>
      </DialogFooter>
    </form>
  );
}

function AddMemoryDialog({
  onOpenChange,
  open,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className='sm:max-w-md'>
        {open && <MemoryForm onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function MemoryRow({ id, text }: { id: string; text: string }) {
  const remove = useMemoryUpdate(removeMemory);
  const restore = useMemoryUpdate(addMemory);

  return (
    <ListRow
      actions={
        <Button
          aria-label={`Forget ${text}`}
          disabled={remove.isPending}
          onClick={() =>
            remove.mutate(id, {
              onSuccess: () =>
                undoToast('Memory forgotten.', () => restore.mutate(text)),
            })
          }
          size='icon-sm'
          variant='quiet'
        >
          <Trash2 aria-hidden='true' />
        </Button>
      }
    >
      <span className='min-w-0 flex-1'>{text}</span>
    </ListRow>
  );
}

export function Memory() {
  const memory = useQuery(memoryQueryOptions);

  const [adding, setAdding] = useState(false);

  const update = useMemoryUpdate((referenceChats: boolean) =>
    updateMemory({ referenceChats })
  );

  const add = (
    <Button onClick={() => setAdding(true)} size='sm'>
      <Plus aria-hidden='true' />
      Add memory
    </Button>
  );

  return (
    <>
      <PageHeader
        actions={add}
        description='Facts Lab remembers about you across chats. Ask it to remember or forget something in any chat, or change them here.'
        title='Memory'
      />
      {memory.isPending && <ListSkeleton />}
      {memory.isLoadingError && (
        <LoadError onRetry={() => memory.refetch()} subject='memory' />
      )}
      {memory.data && (
        <>
          <ul className='flex flex-col gap-0.5'>
            <SettingRow
              control={
                <Switch
                  checked={memory.data.referenceChats}
                  disabled={update.isPending}
                  id='reference-chats'
                  onCheckedChange={(checked) => update.mutate(checked)}
                />
              }
              description='Let Lab search and read your earlier chats when they would help.'
              htmlFor='reference-chats'
              label='Reference other chats'
            />
          </ul>
          <section className='flex flex-col gap-2'>
            <SectionHeading>Memories</SectionHeading>
            {memory.data.memories.length === 0 && (
              <EmptyState
                description='Tell it something worth remembering in any chat, or add a memory here.'
                title='Lab hasn’t learned anything yet'
              />
            )}
            <ul className='flex flex-col gap-0.5'>
              {memory.data.memories.map(({ id, text }) => (
                <MemoryRow key={id} id={id} text={text} />
              ))}
            </ul>
          </section>
        </>
      )}
      <AddMemoryDialog onOpenChange={setAdding} open={adding} />
    </>
  );
}
