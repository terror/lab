import { Markdown } from '@/components/markdown';
import { ModelPicker } from '@/components/model-picker';
import { Button } from '@/components/ui/button';
import {
  abortConversation,
  contentText,
  sendMessage,
  useConversationView,
} from '@/lib/conversations';
import { runFailureTitles } from '@/lib/run-failure';
import { cn } from '@/lib/utils';
import type {
  AgentState,
  InboxState,
  LiveState,
} from '@earendil-works/pi-durable';
import { useMutation } from '@tanstack/react-query';
import { ArrowUp, Square } from 'lucide-react';
import {
  type KeyboardEvent,
  type SubmitEvent,
  useEffect,
  useRef,
  useState,
} from 'react';

type Bubble = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
};

const roles = new Map<string, Bubble['role']>([
  ['lab.message', 'user'],
  ['pi.user', 'user'],
  ['pi.assistant', 'assistant'],
]);

function Message({ bubble }: { bubble: Bubble }) {
  if (bubble.role === 'assistant') {
    return <Markdown>{bubble.text}</Markdown>;
  }

  return (
    <div className='ml-auto max-w-[80%] rounded-2xl bg-muted px-4 py-2 leading-relaxed whitespace-pre-wrap'>
      {bubble.text}
    </div>
  );
}

function Bubbles({ bubbles }: { bubbles: Bubble[] }) {
  return bubbles.map((bubble) => <Message key={bubble.id} bubble={bubble} />);
}

export function Conversation({ id }: { id: number }) {
  const view = useConversationView(id);
  const [draft, setDraft] = useState('');
  const end = useRef<HTMLDivElement>(null);

  const send = useMutation({
    mutationFn: (content: string) => sendMessage(id, content),
    onSuccess: () => setDraft(''),
  });

  const abort = useMutation({ mutationFn: () => abortConversation(id) });

  useEffect(() => {
    if (view) {
      end.current?.scrollIntoView({ block: 'end' });
    }
  }, [view]);

  const live = view?.docs['pi.live'] as LiveState | undefined;
  const inbox = view?.docs['pi.inbox'] as InboxState | undefined;
  const agent = view?.docs['pi.agent'] as AgentState | undefined;

  const bubbles = (view?.entries ?? []).flatMap((entry): Bubble[] => {
    const role = roles.get(entry.kind);
    const text = contentText(entry.model?.[0]?.content);

    if (!role || !text) {
      return [];
    }

    return [{ id: `entry-${entry.id}`, role, text }];
  });

  const partial = contentText(live?.generation?.message?.content);

  const streaming: Bubble[] = partial
    ? [{ id: 'partial', role: 'assistant', text: partial }]
    : [];

  const queued = (inbox?.items ?? []).flatMap((item): Bubble[] => {
    if (item.mode === 'write') {
      return [];
    }

    return [
      {
        id: `queued-${item.id}`,
        role: 'user',
        text: contentText(item.content),
      },
    ];
  });

  const running = live?.run !== undefined;

  const submit = () => {
    const content = draft.trim();

    if (content && !send.isPending) {
      send.mutate(content);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key === 'Enter' &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      submit();
    }
  };

  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    submit();
  };

  return (
    <div className='flex min-h-0 flex-1 flex-col'>
      <div className='min-h-0 flex-1 overflow-y-auto'>
        <div className='mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8'>
          {view === undefined ? (
            <p className='text-sm text-muted-foreground'>Connecting…</p>
          ) : (
            <>
              <Bubbles bubbles={bubbles} />
              <Bubbles bubbles={streaming} />
              {running && !partial && (
                <p className='text-sm text-muted-foreground motion-safe:animate-pulse'>
                  Thinking…
                </p>
              )}
              {live?.runFailure && (
                <p
                  role='alert'
                  className={cn(
                    'text-sm',
                    live.runFailure.reason === 'aborted'
                      ? 'text-muted-foreground'
                      : 'text-destructive'
                  )}
                >
                  {runFailureTitles[live.runFailure.reason]}
                </p>
              )}
              {queued.length > 0 && (
                <div className='flex flex-col gap-2 opacity-60'>
                  <Bubbles bubbles={queued} />
                </div>
              )}
            </>
          )}
          <div ref={end} />
        </div>
      </div>
      <form onSubmit={onSubmit} className='mx-auto w-full max-w-3xl px-6 pb-6'>
        <div className='flex items-end gap-2 rounded-2xl border bg-background p-2 shadow-sm focus-within:ring-3 focus-within:ring-ring/50'>
          <textarea
            aria-label='Message'
            className='max-h-48 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 outline-none'
            disabled={view === undefined}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder='Message Lab…'
            rows={1}
            value={draft}
          />
          <ModelPicker conversation={id} current={agent?.model?.modelId} />
          {running && (
            <Button
              aria-label='Stop'
              disabled={abort.isPending}
              onClick={() => abort.mutate()}
              size='icon'
              type='button'
              variant='outline'
            >
              <Square aria-hidden='true' />
            </Button>
          )}
          <Button
            aria-label='Send'
            disabled={!draft.trim() || send.isPending}
            size='icon'
            type='submit'
          >
            <ArrowUp aria-hidden='true' />
          </Button>
        </div>
        {send.isError && (
          <p role='alert' className='mt-2 text-sm text-destructive'>
            {send.error.message}
          </p>
        )}
      </form>
    </div>
  );
}
