import {
  Activity,
  AssistantMessage,
  replyText,
  type ToolProgress,
  type ToolResult,
} from '@/components/assistant-message';
import { Composer } from '@/components/composer';
import { DocumentCard } from '@/components/document-card';
import { ToolHistory } from '@/components/tools';
import { Bubble, BubbleContent } from '@/components/ui/bubble';
import { Button } from '@/components/ui/button';
import { Message, MessageContent } from '@/components/ui/message';
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
  useMessageScroller,
} from '@/components/ui/message-scroller';
import { type Attachment, imageSource } from '@/lib/attachments';
import { client } from '@/lib/client';
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
import {
  CompactionEntry,
  type AgentState,
  type EntryRecord,
  type InboxState,
  type LiveState,
  type TranscriptItem,
} from '@earendil-works/pi-durable';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { FileText, X } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { z } from 'zod';

type BubbleFile = { name: string; uploadId?: string };

type Bubble = {
  files?: BubbleFile[];
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
    .array(
      z.object({
        name: z.string(),
        type: z.enum(['file', 'image']),
        uploadId: z.string().optional(),
      })
    )
    .optional(),
  text: z.string().optional(),
});

function UserMessage({ bubble }: { bubble: Bubble }) {
  return (
    <Message align='end'>
      <MessageContent>
        {(bubble.images?.length ?? 0) > 0 && (
          <div className='flex flex-wrap justify-end gap-2'>
            {bubble.images?.map((source, index) => (
              <img
                key={index}
                alt=''
                className='max-h-48 max-w-full rounded-2xl object-cover'
                src={source}
              />
            ))}
          </div>
        )}
        {(bubble.files?.length ?? 0) > 0 && (
          <div className='flex flex-wrap justify-end gap-2'>
            {bubble.files?.map(({ name, uploadId }, index) =>
              uploadId ? (
                <DocumentCard key={index} name={name} uploadId={uploadId} />
              ) : (
                <span
                  key={index}
                  className='flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-sm'
                >
                  <FileText aria-hidden='true' className='size-4' />
                  {name}
                </span>
              )
            )}
          </div>
        )}
        {bubble.text && (
          <Bubble align='end' variant='muted'>
            <BubbleContent className='rounded-2xl px-4 text-base whitespace-pre-wrap'>
              {bubble.text}
            </BubbleContent>
          </Bubble>
        )}
      </MessageContent>
    </Message>
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
    <div className='flex items-center justify-end gap-1 opacity-60'>
      <Button
        aria-label='Cancel queued message'
        className='text-muted-foreground'
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

function messageImages(content: unknown, entry: EntryRecord) {
  if (!Array.isArray(content)) {
    return [];
  }

  const images = content.flatMap((part: unknown) => {
    const image = imagePartSchema.safeParse(part);

    return image.success ? [image.data] : [];
  });

  return images.map((image, index) => {
    if (image.data) {
      return imageSource(image);
    }

    return client.conversations[':id'].entries[':entryId'].images[
      ':index'
    ].$url({
      param: {
        entryId: String(entry.id),
        id: String(entry.conversationId),
        index: String(index),
      },
    }).href;
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

function toolProgress(tools: LiveState['tools'] | undefined) {
  return new Map<string, ToolProgress>(
    (tools ?? []).map(({ callId, details, output, status }) => [
      callId,
      { details, output, status },
    ])
  );
}

export type Row =
  | { key: string; kind: 'earlier' }
  | { gap: Gap; key: string; kind: 'gap' }
  | {
      key: string;
      kind: 'assistant';
      parts: Parameters<typeof AssistantMessage>[0]['parts'];
      streaming?: boolean;
    }
  | { bubble: Bubble; key: string; kind: 'user' }
  | { key: string; kind: 'compaction' };

function visible(parts: Extract<Row, { kind: 'assistant' }>['parts']) {
  return parts.some(
    (part) =>
      (part.type === 'text' && part.text.length > 0) || part.type === 'toolCall'
  );
}

function rowsFor(item: TranscriptItem): Row[] {
  if (item.kind === 'earlier') {
    return [{ key: 'earlier', kind: 'earlier' }];
  }

  if (item.kind === 'gap') {
    return [{ gap: item, key: `gap-${item.after}`, kind: 'gap' }];
  }

  const key = `entry-${item.entry.id}`;
  const message = item.entry.model?.[0];

  if (message?.role === 'assistant') {
    return visible(message.content)
      ? [{ key, kind: 'assistant', parts: message.content }]
      : [];
  }

  if (item.entry.kind === CompactionEntry.kind) {
    return [{ key, kind: 'compaction' }];
  }

  if (!userKinds.has(item.entry.kind)) {
    return [];
  }

  const data = messageDataSchema.safeParse(item.entry.data).data;
  const text = data?.text ?? contentText(message?.content);
  const images = messageImages(message?.content, item.entry);

  const files = (data?.files ?? [])
    .filter(({ type }) => type === 'file')
    .map(({ name, uploadId }) => ({ name, uploadId }));

  if (!text && images.length === 0 && files.length === 0) {
    return [];
  }

  return [{ bubble: { files, id: key, images, text }, key, kind: 'user' }];
}

const noParts: Parameters<typeof AssistantMessage>[0]['parts'] = [];

const rowCache = new WeakMap<object, Row[]>();

function cachedRows(item: TranscriptItem) {
  const source = item.kind === 'entry' ? item.entry : item;

  const cached = rowCache.get(source);

  if (cached) {
    return cached;
  }

  const rows = rowsFor(item);

  rowCache.set(source, rows);

  return rows;
}

export function mergeReplies(rows: readonly Row[]) {
  const merged: Row[] = [];

  for (const row of rows) {
    const last = merged.at(-1);

    if (row.kind === 'assistant' && last?.kind === 'assistant') {
      merged[merged.length - 1] = {
        ...last,
        parts: [...last.parts, ...row.parts],
      };
    } else {
      merged.push(row);
    }
  }

  return merged;
}

function replyKeys(rows: readonly Row[]) {
  return rows.reduce<{ count: number; keys: string[]; user: string }>(
    (state, row) => {
      if (row.kind === 'user') {
        return { count: 0, keys: [...state.keys, row.key], user: row.key };
      }

      if (row.kind === 'assistant') {
        const count = state.count + 1;

        return {
          count,
          keys: [...state.keys, `reply-${state.user}-${count}`],
          user: state.user,
        };
      }

      return { ...state, keys: [...state.keys, row.key] };
    },
    { count: 0, keys: [], user: 'start' }
  );
}

const TranscriptRow = memo(function TranscriptRow({
  activity,
  latest,
  loading,
  onEarlier,
  onGap,
  progress,
  results,
  row,
}: {
  activity: string | undefined;
  latest: boolean;
  loading: boolean;
  onEarlier: () => void;
  onGap: (gap: Gap) => void;
  progress: ReadonlyMap<string, ToolProgress>;
  results: ReadonlyMap<string, ToolResult>;
  row: Row;
}) {
  if (row.kind === 'compaction') {
    return (
      <div className='flex items-center gap-3 text-xs text-muted-foreground'>
        <span className='h-px flex-1 bg-border' />
        Earlier messages summarized
        <span className='h-px flex-1 bg-border' />
      </div>
    );
  }

  if (row.kind === 'earlier' || row.kind === 'gap') {
    return (
      <div className='flex justify-center'>
        <Button
          disabled={loading}
          onClick={() => (row.kind === 'gap' ? onGap(row.gap) : onEarlier())}
          size='sm'
          variant='ghost'
        >
          {row.kind === 'gap'
            ? 'Load missing messages'
            : 'Load earlier messages'}
        </Button>
      </div>
    );
  }

  if (row.kind === 'assistant') {
    return (
      <AssistantMessage
        activity={activity}
        latest={latest}
        parts={row.parts}
        progress={progress}
        results={results}
        streaming={row.streaming ?? false}
      />
    );
  }

  return <UserMessage bubble={row.bubble} />;
});

export function Conversation({ id }: { id: number }) {
  return (
    <MessageScrollerProvider>
      <ConversationView id={id} />
    </MessageScrollerProvider>
  );
}

function ConversationView({ id }: { id: number }) {
  const { scrollToEnd } = useMessageScroller();
  const { view, status: activity, loadEarlier, fillGap } = useConversation(id);
  const [draft, setDraft] = useDraft(id);
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const queryClient = useQueryClient();

  const send = useMutation({
    meta: { inlineError: true },
    mutationFn: ({
      content,
      sent,
      steer,
    }: {
      content: string;
      sent: Attachment[];
      steer: boolean;
    }) => sendMessage(id, content, sent, steer),
    onSuccess: (_, { content, sent }) => {
      if (draft.trim() === content) {
        setDraft('');
      }

      setAttachments((current) =>
        current.filter((attachment) => !sent.includes(attachment))
      );

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

  const live = view?.docs['pi.live'] as LiveState | undefined;
  const inbox = view?.docs['pi.inbox'] as InboxState | undefined;
  const agent = view?.docs['pi.agent'] as AgentState | undefined;

  const partial = live?.generation?.message?.content ?? noParts;

  const answering = visible(partial);

  const retry = live?.generation?.retry;

  const results = useMemo(() => toolResults(view?.items ?? []), [view?.items]);

  const committed = useMemo(
    () => mergeReplies((view?.items ?? []).flatMap(cachedRows)),
    [view?.items]
  );

  const history = useMemo(
    () =>
      committed.flatMap((row) =>
        row.kind === 'assistant'
          ? row.parts.flatMap((part) =>
              part.type === 'toolCall'
                ? [
                    {
                      args: part.arguments,
                      details: results.get(part.id)?.details,
                      name: part.name,
                    },
                  ]
                : []
            )
          : []
      ),
    [committed, results]
  );

  const keyed = useMemo(() => replyKeys(committed), [committed]);

  const rows = useMemo(() => {
    const base = committed.map((row, index) => ({
      key: keyed.keys[index] ?? row.key,
      row,
    }));

    if (!answering) {
      return base;
    }

    const last = base.at(-1);

    if (last?.row.kind === 'assistant') {
      const row: Row = {
        key: last.key,
        kind: 'assistant',
        parts: [...last.row.parts, ...partial],
        streaming: true,
      };

      return [...base.slice(0, -1), { key: last.key, row }];
    }

    const key = `reply-${keyed.user}-${keyed.count + 1}`;

    const row: Row = {
      key,
      kind: 'assistant',
      parts: partial,
      streaming: true,
    };

    return [...base, { key, row }];
  }, [answering, committed, keyed, partial]);

  const navigate = useNavigate();

  const lastReply = useMemo(() => {
    const row = committed.findLast(({ kind }) => kind === 'assistant');

    const text = row?.kind === 'assistant' ? replyText(row.parts) : '';

    return text || undefined;
  }, [committed]);

  const commandContext = useMemo(
    () => ({
      conversationId: id,
      lastReply,
      newChat: () => void navigate({ to: '/' }),
    }),
    [id, lastReply, navigate]
  );

  const loadEarlierMessages = earlier.mutate;

  const fillMessageGap = gap.mutate;

  const onEarlier = useCallback(
    () => loadEarlierMessages(),
    [loadEarlierMessages]
  );

  const onGap = useCallback(
    (value: Gap) => fillMessageGap(value),
    [fillMessageGap]
  );

  const latest = committed.findLast(({ kind }) => kind === 'assistant');

  const anchor = committed.findLast(({ kind }) => kind === 'user');

  const progress = useMemo(() => toolProgress(live?.tools), [live?.tools]);

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

  const thinking =
    running && !retry && !answering && !toolsRunning && !finishing
      ? (activity ?? 'Thinking')
      : undefined;

  const last = rows.at(-1)?.row;

  const inline =
    thinking !== undefined && last?.kind === 'assistant' ? last : undefined;

  return (
    <div className='flex min-h-0 flex-1 flex-col'>
      <MessageScroller className='flex-1'>
        <MessageScrollerViewport aria-label='Transcript'>
          <MessageScrollerContent
            className='mx-auto max-w-3xl px-6 py-8'
            spacerClassName={cn(!running && 'hidden!')}
          >
            <ToolHistory value={history}>
              {view === undefined && (
                <p className='text-sm text-muted-foreground'>Connecting…</p>
              )}
              {rows.map(({ key, row }) => (
                <MessageScrollerItem
                  key={key}
                  messageId={key}
                  scrollAnchor={row === anchor}
                >
                  <TranscriptRow
                    activity={row === inline ? thinking : undefined}
                    latest={row === latest && !running}
                    loading={earlier.isPending || gap.isPending}
                    onEarlier={onEarlier}
                    onGap={onGap}
                    progress={progress}
                    results={results}
                    row={row}
                  />
                </MessageScrollerItem>
              ))}
              {retry && <RetryStatus retry={retry} />}
              {thinking !== undefined && inline === undefined && (
                <Activity status={thinking} />
              )}
              {!running && (live?.compactions?.length ?? 0) > 0 && (
                <Activity status='Summarizing earlier messages' />
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
              {queued.map(({ bubble, submission }) => (
                <QueuedMessage
                  key={bubble.id}
                  bubble={bubble}
                  onCancel={() => cancel.mutate(submission)}
                />
              ))}
            </ToolHistory>
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton
          className='rounded-full shadow-md ring-1 ring-foreground/10'
          size='icon'
        />
      </MessageScroller>
      <div className='mx-auto w-full max-w-3xl px-6 pb-6'>
        <Composer
          attachments={attachments}
          commandContext={commandContext}
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
          onDraftChange={(value) => {
            if (send.isError) {
              send.reset();
            }

            setDraft(value);
          }}
          onModelChange={(model) => changeModel.mutate(model)}
          onStop={() => abort.mutate()}
          onSteer={(content) => {
            scrollToEnd({ behavior: 'smooth' });
            send.mutate({ content, steer: true, sent: attachments });
          }}
          onSubmit={(content) => {
            scrollToEnd({ behavior: 'smooth' });
            send.mutate({ content, steer: false, sent: attachments });
          }}
          running={running}
          submitting={send.isPending}
        />
      </div>
    </div>
  );
}
