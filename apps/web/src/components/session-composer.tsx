import { Button } from '@/components/ui/button';
import type { SessionActivity } from '@/lib/session-state';
import { ArrowUp, Square } from 'lucide-react';
import { useState } from 'react';

export function SessionComposer({
  activity,
  onSend,
  onStop,
}: {
  activity: SessionActivity;
  onSend?: (text: string) => boolean;
  onStop?: () => void;
}) {
  const [text, setText] = useState('');

  const stopping = activity.status === 'stopping';

  return (
    <form
      className='rounded-xl border bg-background p-3 focus-within:ring-2 focus-within:ring-ring/50'
      onSubmit={(event) => {
        event.preventDefault();

        if (text.trim() && onSend?.(text.trim())) {
          setText('');
        }
      }}
    >
      <label htmlFor='message' className='sr-only'>
        Message
      </label>

      <textarea
        id='message'
        rows={3}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (
            event.key === 'Enter' &&
            (event.metaKey || event.ctrlKey) &&
            !event.nativeEvent.isComposing
          ) {
            event.preventDefault();

            event.currentTarget.form?.requestSubmit();
          }
        }}
        placeholder='Message your agent…'
        className='block w-full resize-none bg-transparent text-sm leading-6 outline-none placeholder:text-muted-foreground'
      />

      <div className='mt-2 flex items-center justify-between gap-3'>
        <p className='text-xs text-muted-foreground'>
          ⌘ / Ctrl + Enter to send
        </p>

        {onStop || stopping ? (
          <Button
            type='button'
            variant='outline'
            disabled={!onStop}
            onClick={onStop}
          >
            <Square aria-hidden='true' />
            {stopping ? 'Stopping' : 'Stop'}
          </Button>
        ) : (
          <Button type='submit' disabled={!onSend || !text.trim()}>
            <ArrowUp aria-hidden='true' />
            Send
          </Button>
        )}
      </div>
    </form>
  );
}
