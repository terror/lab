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
  contentText,
  conversationsQueryOptions,
  sendMessage,
  type Gap,
  useConversation,
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
import { FileText } from 'lucide-react';
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
    <div className='ml-auto flex max-w-[80%] flex-col items-end gap-1'>
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
  const { view, loadEarlier, fillGap } = useConversation(id);
  const [draft, setDraft] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const end = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);

  const queryClient = useQueryClient();

  const send = useMutation({
    mutationFn: (content: string) => sendMessage(id, content, attachments),
    onSuccess: () => {
      setDraft('');
      setAttachments([]);
    },
  });

  const abort = useMutation({ mutationFn: () => abortConversation(id) });

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
          attachments={attachments}
          disabled={view === undefined}
          draft={draft}
          error={send.error?.message}
          model={
            agent?.model && {
              id: agent.model.modelId,
              thinkingLevel: agent.thinkingLevel,
            }
          }
          onAttachmentsChange={setAttachments}
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
