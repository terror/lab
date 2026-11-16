import {
  AssistantMessage,
  type ToolProgress,
  type ToolResult,
} from '@/components/assistant-message';
import { Composer } from '@/components/composer';
import { Button } from '@/components/ui/button';
import {
  abortConversation,
  contentText,
  conversationsQueryOptions,
  sendMessage,
  type Gap,
  useConversation,
} from '@/lib/conversations';
import { setConversationModel } from '@/lib/models';
import { runFailureTitles } from '@/lib/run-failure';
import { cn } from '@/lib/utils';
import type {
  AgentState,
  InboxState,
  LiveState,
  TranscriptItem,
} from '@earendil-works/pi-durable';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type UIEvent, useEffect, useMemo, useRef, useState } from 'react';

type Bubble = {
  id: string;
  text: string;
};

const userKinds = new Set(['lab.message', 'pi.user']);

function UserMessage({ bubble }: { bubble: Bubble }) {
  return (
    <div className='ml-auto max-w-[80%] rounded-2xl bg-muted px-4 py-2 leading-relaxed whitespace-pre-wrap'>
      {bubble.text}
    </div>
  );
}

function toolResults(items: readonly TranscriptItem[]) {
  const results = new Map<string, ToolResult>();

  for (const item of items) {
    const message = item.kind === 'entry' ? item.entry.model?.[0] : undefined;

    if (message?.role === 'toolResult') {
      results.set(message.toolCallId, {
        details: message.details,
        isError: message.isError,
        output: contentText(message.content),
      });
    }
  }

  return results;
}

function toolProgress(live: LiveState | undefined) {
  return new Map<string, ToolProgress>(
    (live?.tools ?? []).map(({ callId, details, output, status }) => [
      callId,
      { details, output, status },
    ])
  );
}

function itemKey(item: TranscriptItem) {
  if (item.kind === 'entry') {
    return `entry-${item.entry.id}`;
  }

  if (item.kind === 'gap') {
    return `gap-${item.after}`;
  }

  return 'earlier';
}

function TranscriptRow({
  item,
  loading,
  onEarlier,
  onGap,
  progress,
  results,
}: {
  item: TranscriptItem;
  loading: boolean;
  onEarlier: () => void;
  onGap: (gap: Gap) => void;
  progress: ReadonlyMap<string, ToolProgress>;
  results: ReadonlyMap<string, ToolResult>;
}) {
  if (item.kind === 'earlier') {
    return (
      <Button
        className='self-center'
        disabled={loading}
        onClick={onEarlier}
        size='sm'
        variant='ghost'
      >
        Load earlier messages
      </Button>
    );
  }

  if (item.kind === 'gap') {
    return (
      <Button
        className='self-center'
        disabled={loading}
        onClick={() => onGap(item)}
        size='sm'
        variant='ghost'
      >
        Load missing messages
      </Button>
    );
  }

  const message = item.entry.model?.[0];

  if (message?.role === 'assistant') {
    return (
      <AssistantMessage
        parts={message.content}
        progress={progress}
        results={results}
        streaming={false}
      />
    );
  }

  const text = contentText(message?.content);

  if (!userKinds.has(item.entry.kind) || !text) {
    return null;
  }

  return <UserMessage bubble={{ id: `entry-${item.entry.id}`, text }} />;
}

export function Conversation({ id }: { id: number }) {
  const { view, loadEarlier, fillGap } = useConversation(id);
  const [draft, setDraft] = useState('');
  const end = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);

  const queryClient = useQueryClient();

  const send = useMutation({
    mutationFn: (content: string) => sendMessage(id, content),
    onSuccess: () => setDraft(''),
  });

  const abort = useMutation({ mutationFn: () => abortConversation(id) });

  const changeModel = useMutation({
    mutationFn: (model: string) => setConversationModel(id, model),
  });

  const earlier = useMutation({ mutationFn: loadEarlier });
  const gap = useMutation({ mutationFn: fillGap });

  useEffect(() => {
    if (view && pinned.current) {
      end.current?.scrollIntoView({ block: 'end' });
    }
  }, [view]);

  const live = view?.docs['pi.live'] as LiveState | undefined;
  const inbox = view?.docs['pi.inbox'] as InboxState | undefined;
  const agent = view?.docs['pi.agent'] as AgentState | undefined;

  const partial = live?.generation?.message?.content ?? [];

  const results = useMemo(() => toolResults(view?.items ?? []), [view?.items]);

  const progress = toolProgress(live);

  const toolsRunning = (live?.tools ?? []).some(
    ({ status }) => status !== 'done'
  );

  const queued = (inbox?.items ?? []).flatMap((item): Bubble[] => {
    if (item.mode === 'write') {
      return [];
    }

    return [{ id: `queued-${item.id}`, text: contentText(item.content) }];
  });

  const running = live?.run !== undefined;
  const finishing = live?.run?.afterRun !== undefined;

  useEffect(() => {
    if (!running) {
      void queryClient.invalidateQueries(conversationsQueryOptions);
    }
  }, [queryClient, running]);

  const onScroll = (event: UIEvent<HTMLDivElement>) => {
    const { clientHeight, scrollHeight, scrollTop } = event.currentTarget;

    pinned.current = scrollHeight - scrollTop - clientHeight < 80;
  };

  return (
    <div className='flex min-h-0 flex-1 flex-col'>
      <div className='min-h-0 flex-1 overflow-y-auto' onScroll={onScroll}>
        <div className='mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8'>
          {view === undefined ? (
            <p className='text-sm text-muted-foreground'>Connecting…</p>
          ) : (
            <>
              {view.items.map((item) => (
                <TranscriptRow
                  key={itemKey(item)}
                  item={item}
                  loading={earlier.isPending || gap.isPending}
                  onEarlier={() => earlier.mutate()}
                  onGap={(value) => gap.mutate(value)}
                  progress={progress}
                  results={results}
                />
              ))}
              {partial.length > 0 && (
                <AssistantMessage
                  parts={partial}
                  progress={progress}
                  results={results}
                  streaming
                />
              )}
              {running &&
                partial.length === 0 &&
                !toolsRunning &&
                !finishing && (
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
                  {queued.map((bubble) => (
                    <UserMessage key={bubble.id} bubble={bubble} />
                  ))}
                </div>
              )}
            </>
          )}
          <div ref={end} />
        </div>
      </div>
      <div className='mx-auto w-full max-w-3xl px-6 pb-6'>
        <Composer
          disabled={view === undefined}
          draft={draft}
          error={send.error?.message}
          model={agent?.model?.modelId}
          onDraftChange={setDraft}
          onModelChange={(model) => changeModel.mutate(model)}
          onStop={() => abort.mutate()}
          onSubmit={(content) => {
            pinned.current = true;
            send.mutate(content);
          }}
          running={running}
          submitting={send.isPending}
        />
      </div>
    </div>
  );
}
