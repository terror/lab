import { Button } from '@/components/ui/button';
import { useSession } from '@/lib/use-session';
import { ArrowUp, LoaderCircle, Square, Wrench } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export function SessionWorkspace({ sessionId }: { sessionId: string }) {
  const { session, sending, stopping, reconnecting, send } =
    useSession(sessionId);

  const [text, setText] = useState('');

  const transcript = useRef<HTMLDivElement>(null);

  const following = useRef(true);

  const revision = session.data?.revision;

  useEffect(() => {
    if (revision !== undefined && following.current && transcript.current) {
      transcript.current.scrollTop = transcript.current.scrollHeight;
    }
  }, [revision]);

  if (!session.data) {
    return (
      <main className='mx-auto max-w-3xl px-6 py-16'>
        {session.isError ? (
          <div className='space-y-4'>
            <p role='alert' className='text-destructive'>
              {session.error.message}
            </p>

            <Button variant='outline' onClick={() => void session.refetch()}>
              Try again
            </Button>
          </div>
        ) : (
          <p role='status' className='text-muted-foreground'>
            Loading session…
          </p>
        )}
      </main>
    );
  }

  const running = session.data.running || sending.isPending;

  const error = sending.error ?? stopping.error ?? session.error;

  return (
    <main className='mx-auto flex h-[calc(100svh-4rem)] max-w-3xl flex-col'>
      <div className='flex items-center justify-between border-b px-6 py-4'>
        <h1 className='font-medium'>Session</h1>

        <p
          role='status'
          className='flex items-center gap-2 text-sm text-muted-foreground'
        >
          {(running || reconnecting) && (
            <LoaderCircle
              aria-hidden='true'
              className='size-3.5 motion-safe:animate-spin'
            />
          )}

          {stopping.isPending
            ? 'Stopping'
            : reconnecting
              ? 'Reconnecting'
              : running
                ? 'Working'
                : 'Ready'}
        </p>
      </div>

      <div
        ref={transcript}
        className='min-h-0 flex-1 overflow-y-auto px-6 py-8'
        onScroll={() => {
          const element = transcript.current;

          if (element) {
            following.current =
              element.scrollHeight - element.scrollTop - element.clientHeight <
              80;
          }
        }}
      >
        <section aria-label='Conversation' className='space-y-8'>
          {session.data.messages.length === 0 && !running && (
            <div className='py-12 text-center'>
              <h2 className='text-xl font-semibold'>
                What would you like to work on?
              </h2>

              <p className='mt-2 text-sm text-muted-foreground'>
                Send a message to start this session.
              </p>
            </div>
          )}

          {session.data.messages.map((message) => (
            <article key={message.id} className='space-y-2'>
              <h2 className='text-sm font-medium text-muted-foreground'>
                {message.role === 'user' ? 'You' : 'Agent'}
              </h2>

              {message.text && (
                <p className='text-sm leading-7 break-words whitespace-pre-wrap'>
                  {message.text}
                </p>
              )}

              {message.interrupted && (
                <p className='text-xs text-muted-foreground'>
                  Response interrupted
                </p>
              )}

              {message.error && (
                <p className='text-sm text-destructive'>{message.error}</p>
              )}
            </article>
          ))}

          {session.data.partial && (
            <article className='space-y-2'>
              <h2 className='text-sm font-medium text-muted-foreground'>
                Agent
              </h2>

              <p className='text-sm leading-7 break-words whitespace-pre-wrap'>
                {session.data.partial}
              </p>
            </article>
          )}
        </section>

        {session.data.tools.length > 0 && (
          <details className='mt-8 rounded-xl border p-4'>
            <summary className='cursor-pointer text-sm font-medium'>
              Tool activity ({session.data.tools.length})
            </summary>

            <ul className='mt-4 space-y-3'>
              {session.data.tools.map((tool) => (
                <li key={tool.id} className='flex items-center gap-2 text-sm'>
                  <Wrench
                    aria-hidden='true'
                    className='size-3.5 text-muted-foreground'
                  />

                  <span className='min-w-0 flex-1 break-words'>
                    {tool.name}
                  </span>

                  <span className='text-xs text-muted-foreground'>
                    {tool.status === 'running'
                      ? 'Running'
                      : tool.status === 'pending'
                        ? 'Pending'
                        : 'Finished'}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      <div className='space-y-3 border-t bg-background px-6 py-4'>
        {error && (
          <div className='flex flex-wrap items-center gap-3'>
            <p role='alert' className='text-sm text-destructive'>
              {error.message}
            </p>

            {sending.isError && sending.variables && !running && (
              <Button
                variant='outline'
                size='sm'
                onClick={() => sending.mutate(sending.variables!)}
              >
                Retry message
              </Button>
            )}
          </div>
        )}

        <form
          className='rounded-xl border bg-background p-3 focus-within:ring-2 focus-within:ring-ring/50'
          onSubmit={(event) => {
            event.preventDefault();

            if (!text.trim() || running || stopping.isPending) {
              return;
            }

            following.current = true;

            send(text.trim());

            setText('');
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

            {running ? (
              <Button
                type='button'
                variant='outline'
                disabled={!session.data.running || stopping.isPending}
                onClick={() => stopping.mutate()}
              >
                <Square aria-hidden='true' />
                {stopping.isPending ? 'Stopping' : 'Stop'}
              </Button>
            ) : (
              <Button
                type='submit'
                disabled={!text.trim() || stopping.isPending}
              >
                <ArrowUp aria-hidden='true' />
                Send
              </Button>
            )}
          </div>
        </form>
      </div>
    </main>
  );
}
