import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  type MemoryState,
  addMemory,
  memoryQueryOptions,
  removeMemory,
  saveInstructions,
} from '@/lib/memory';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type SubmitEvent, useState } from 'react';

function useUpdate<T>(mutationFn: (value: T) => Promise<MemoryState>) {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { inlineError: true },
    mutationFn,
    onSuccess: (state) =>
      queryClient.setQueryData(memoryQueryOptions.queryKey, state),
  });
}

function Instructions({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);

  const save = useUpdate(saveInstructions);

  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    save.mutate(value);
  };

  return (
    <form className='flex flex-col gap-3' onSubmit={onSubmit}>
      <div className='space-y-1'>
        <label className='text-sm font-medium' htmlFor='instructions'>
          Custom instructions
        </label>
        <p className='text-sm text-muted-foreground'>
          What Lab should know about you and how it should respond.
        </p>
      </div>
      <Textarea
        id='instructions'
        maxLength={4_000}
        onChange={(event) => setValue(event.target.value)}
        placeholder='I’m a software engineer. Keep answers short and show code first.'
        rows={5}
        value={value}
      />
      <div className='flex justify-end'>
        <Button
          disabled={value === initial || save.isPending}
          size='sm'
          type='submit'
        >
          Save
        </Button>
      </div>
    </form>
  );
}

function Memories({ memories }: { memories: MemoryState['memories'] }) {
  const [text, setText] = useState('');

  const add = useUpdate(addMemory);
  const remove = useUpdate(removeMemory);

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

export function Personalization() {
  const memory = useQuery(memoryQueryOptions);

  return (
    <section className='space-y-8'>
      <div className='space-y-1'>
        <h1 className='text-2xl font-semibold tracking-tight'>
          Personalization
        </h1>
        <p className='text-sm text-muted-foreground'>
          Instructions and memories Lab uses in every chat.
        </p>
      </div>
      {memory.isError && (
        <p role='alert' className='text-sm text-destructive'>
          Unable to load personalization.
        </p>
      )}
      {memory.data && (
        <>
          <Instructions
            key={memory.data.instructions}
            initial={memory.data.instructions}
          />
          <Memories memories={memory.data.memories} />
        </>
      )}
    </section>
  );
}
