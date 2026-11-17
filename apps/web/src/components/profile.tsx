import { LoadError } from '@/components/load-error';
import { SettingsPage } from '@/components/settings-page';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  memoryQueryOptions,
  updateMemory,
  useMemoryUpdate,
} from '@/lib/memory';
import { useQuery } from '@tanstack/react-query';
import { type SubmitEvent, useState } from 'react';

function Instructions({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);

  const save = useMemoryUpdate((instructions: string) =>
    updateMemory({ instructions })
  );

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

export function Profile() {
  const memory = useQuery(memoryQueryOptions);

  return (
    <SettingsPage
      description='How Lab should respond in every chat.'
      title='Profile'
    >
      {memory.isError && <LoadError subject='your profile' />}
      {memory.data && (
        <Instructions
          key={memory.data.instructions}
          initial={memory.data.instructions}
        />
      )}
    </SettingsPage>
  );
}
