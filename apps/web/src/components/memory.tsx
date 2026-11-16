import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  type MemoryState,
  addMemory,
  memoryQueryOptions,
  removeMemory,
  updateMemory,
  useMemoryUpdate,
} from '@/lib/memory';
import { useQuery } from '@tanstack/react-query';
import { type SubmitEvent, useState } from 'react';

function Memories({ memories }: { memories: MemoryState['memories'] }) {
  const [text, setText] = useState('');

  const add = useMemoryUpdate(addMemory);
  const remove = useMemoryUpdate(removeMemory);

  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    add.mutate(text.trim(), { onSuccess: () => setText('') });
  };

  return (
    <div className='flex flex-col gap-3'>
      <div className='space-y-1'>
        <h2 className='text-sm font-medium'>Memories</h2>
        <p className='text-sm text-muted-foreground'>
          Facts Lab remembers across chats. Ask it to remember or forget
          something, or edit them here.
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
      <form className='flex items-center gap-2' onSubmit={onSubmit}>
        <Input
          aria-label='New memory'
          maxLength={500}
          onChange={(event) => setText(event.target.value)}
          placeholder='Add a memory'
          value={text}
        />
        <Button
          disabled={!text.trim() || add.isPending}
          size='sm'
          type='submit'
          variant='secondary'
        >
          Add
        </Button>
      </form>
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

  return (
    <section className='space-y-8'>
      <div className='space-y-1'>
        <h1 className='text-2xl font-semibold tracking-tight'>Memory</h1>
        <p className='text-sm text-muted-foreground'>
          What Lab remembers about you across chats.
        </p>
      </div>
      {memory.isError && (
        <p role='alert' className='text-sm text-destructive'>
          Unable to load memory.
        </p>
      )}
      {memory.data && (
        <>
          <ReferenceChats enabled={memory.data.referenceChats} />
          <Memories memories={memory.data.memories} />
        </>
      )}
    </section>
  );
}
