import {
  AssistantMessage,
  type ToolProgress,
  type ToolResult,
} from '@/components/assistant-message';
import { Composer } from '@/components/composer';
import { Button } from '@/components/ui/button';
import { type Attachment, imageSource } from '@/lib/attachments';
import {
  abortConversation,
  cancelSubmission,
  contentText,
  conversationsQueryKey,
  sendMessage,
  type Gap,
  useConversation,
  useDraft,
} from '@/lib/conversations';
import {
  type ModelChoice,
  setConversationModel,
  usePreferredModel,
} from '@/lib/models';
import { runFailureTitles } from '@/lib/run-failure';
import { cn } from '@/lib/utils';
import type {
  AgentState,
  InboxState,
  LiveState,
  TranscriptItem,
} from '@earendil-works/pi-durable';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, X } from 'lucide-react';
import { AnimatePresence, m } from 'motion/react';
import { type UIEvent, useEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';

type Bubble = {
  files?: string[];
  id: string;
  images?: string[];
  text: string;
};

const userKinds = new Set(['lab.message', 'pi.user']);

const imagePartSchema = z.object({
  data: z.string(),
  mimeType: z.string(),
  type: z.literal('image'),
});

const messageDataSchema = z.object({
  files: z
    .array(z.object({ name: z.string(), type: z.enum(['file', 'image']) }))
    .optional(),
  text: z.string().optional(),
});

function UserMessage({ bubble }: { bubble: Bubble }) {
  return (
    <div className='ml-auto flex max-w-4/5 flex-col items-end gap-1'>
      {(bubble.images?.length ?? 0) > 0 && (
        <div className='flex flex-wrap justify-end gap-2'>
          {bubble.images?.map((source, index) => (
            <img
              key={index}
              alt=''
              className='max-h-48 max-w-full rounded-2xl border object-cover'
              src={source}
            />
          ))}
        </div>
      )}
      {(bubble.files?.length ?? 0) > 0 && (
        <div className='flex flex-wrap justify-end gap-2'>
          {bubble.files?.map((name, index) => (
            <span
              key={index}
              className='flex items-center gap-2 rounded-xl border px-3 py-2 text-sm'
            >
              <FileText aria-hidden='true' className='size-4' />
              {name}
            </span>
          ))}
        </div>
      )}
      {bubble.text && (
        <div className='rounded-2xl bg-muted px-4 py-2 leading-relaxed whitespace-pre-wrap'>
          {bubble.text}
        </div>
      )}
    </div>
  );
}

function useSecondsUntil(at: number) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);

    return () => window.clearInterval(timer);
  }, []);

  return Math.max(0, Math.ceil((at - now) / 1_000));
}

function Activity({ status }: { status: string | undefined }) {
  const label = status ?? 'Thinking';

  return (
    <output className='flex text-sm'>
      <AnimatePresence initial={false} mode='wait'>
        <m.span
          key={label}
          animate={{ opacity: 1, y: 0 }}
          className='shimmer text-muted-foreground'
          exit={{ opacity: 0, y: -4 }}
          initial={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.2 }}
        >
          {label}
        </m.span>
      </AnimatePresence>
    </output>
  );
}

function RetryStatus({ retry }: { retry: { at: number; error: string } }) {
  const seconds = useSecondsUntil(retry.at);

  const when = seconds > 0 ? `in ${seconds}s` : 'now';

  return (
    <output className='flex flex-col gap-1 text-sm text-muted-foreground'>
      <span className='motion-safe:animate-pulse'>Retrying {when}…</span>
      <span className='text-xs wrap-break-word'>{retry.error}</span>
    </output>
  );
}

function QueuedMessage({
  bubble,
  onCancel,
}: {
  bubble: Bubble;
  onCancel: () => void;
}) {
  return (
    <div className='flex items-start justify-end gap-1'>
      <Button
        aria-label='Cancel queued message'
        className='mt-1 text-muted-foreground'
        onClick={onCancel}
        size='icon-xs'
        variant='ghost'
      >
        <X aria-hidden='true' />
      </Button>
      <UserMessage bubble={bubble} />
    </div>
  );
}

function messageImages(content: unknown) {
  if (!Array.isArray(content)) {
    return [];
  }

  return content.flatMap((part: unknown) => {
    const image = imagePartSchema.safeParse(part);

    return image.success ? [imageSource(image.data)] : [];
  });
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
  latest,
  loading,
  onEarlier,
  onGap,
  progress,
  results,
}: {
  item: TranscriptItem;
  latest: boolean;
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
        latest={latest}
        parts={message.content}
        progress={progress}
        results={results}
        streaming={false}
      />
    );
  }

  if (!userKinds.has(item.entry.kind)) {
    return null;
  }

  const data = messageDataSchema.safeParse(item.entry.data).data;
  const text = data?.text ?? contentText(message?.content);
  const images = messageImages(message?.content);

  const files = (data?.files ?? [])
    .filter(({ type }) => type === 'file')
    .map(({ name }) => name);

  if (!text && images.length === 0 && files.length === 0) {
    return null;
  }

  return (
    <UserMessage
      bubble={{ files, id: `entry-${item.entry.id}`, images, text }}
    />
  );
}

export function Conversation({ id }: { id: number }) {
  const { view, status: activity, loadEarlier, fillGap } = useConversation(id);
  const [draft, setDraft] = useDraft(id);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const end = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);

  const queryClient = useQueryClient();

  const send = useMutation({
    meta: { inlineError: true },
    mutationFn: ({ content, steer }: { content: string; steer: boolean }) =>
      sendMessage(id, content, attachments, steer),
    onSuccess: () => {
      setDraft('');
      setAttachments([]);
      void queryClient.invalidateQueries({ queryKey: conversationsQueryKey });
    },
  });

  const abort = useMutation({ mutationFn: () => abortConversation(id) });

  const cancel = useMutation({
    mutationFn: (submission: number) => cancelSubmission(id, submission),
  });

  const [, setPreferredModel] = usePreferredModel();

  const changeModel = useMutation({
    mutationFn: (model: ModelChoice) => setConversationModel(id, model),
    onSuccess: (_, model) => setPreferredModel(model),
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

  const answering = partial.some(
    (part) =>
      (part.type === 'text' && part.text.length > 0) || part.type === 'toolCall'
  );

  const retry = live?.generation?.retry;

  const results = useMemo(() => toolResults(view?.items ?? []), [view?.items]);

  const latest = view?.items.findLast(
    (item) =>
      item.kind === 'entry' && item.entry.model?.[0]?.role === 'assistant'
  );

  const progress = toolProgress(live);

  const toolsRunning = (live?.tools ?? []).some(
    ({ status }) => status !== 'done'
  );

  const queued = (inbox?.items ?? []).flatMap((item) => {
    if (item.mode === 'write') {
      return [];
    }

    const bubble = { id: `queued-${item.id}`, text: contentText(item.content) };

    return [{ bubble, submission: Number(item.id) }];
  });

  const running = live?.run !== undefined;
  const finishing = live?.run?.afterRun !== undefined;

  useEffect(() => {
    if (!running) {
      void queryClient.invalidateQueries({ queryKey: conversationsQueryKey });
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
                  latest={item === latest && !running}
                  loading={earlier.isPending || gap.isPending}
                  onEarlier={() => earlier.mutate()}
                  onGap={(value) => gap.mutate(value)}
                  progress={progress}
                  results={results}
                />
              ))}
              {answering && (
                <AssistantMessage
                  parts={partial}
                  progress={progress}
                  results={results}
                  streaming
                />
              )}
              {retry && <RetryStatus retry={retry} />}
              {running &&
                !retry &&
                !answering &&
                !toolsRunning &&
                !finishing && <Activity status={activity} />}
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
                  {queued.map(({ bubble, submission }) => (
                    <QueuedMessage
                      key={bubble.id}
                      bubble={bubble}
                      onCancel={() => cancel.mutate(submission)}
                    />
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
          attachments={attachments}
          disabled={view === undefined}
          draft={draft}
          error={send.error?.message}
          model={
            agent?.model && {
              id: agent.model.modelId,
              provider: agent.model.provider,
              thinkingLevel: agent.thinkingLevel,
            }
          }
          onAttachmentsChange={setAttachments}
          onDraftChange={setDraft}
          onModelChange={(model) => changeModel.mutate(model)}
          onStop={() => abort.mutate()}
          onSteer={(content) => {
            pinned.current = true;
            send.mutate({ content, steer: true });
          }}
          onSubmit={(content) => {
            pinned.current = true;
            send.mutate({ content, steer: false });
          }}
          running={running}
          submitting={send.isPending}
        />
      </div>
    </div>
  );
}
