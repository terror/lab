import {
  Action,
  Activity,
  AssistantMessage,
  RunFailure,
  replyText,
  type ShownPlan,
  type ToolProgress,
  type ToolResult,
} from '@/components/assistant-message';
import { Composer } from '@/components/composer';
import { DocumentCard } from '@/components/document-card';
import { LoadMore } from '@/components/load-more';
import { ToolConversation, ToolHistory } from '@/components/tools';
import { Bubble, BubbleContent } from '@/components/ui/bubble';
import { Button } from '@/components/ui/button';
import {
  Message,
  MessageContent,
  MessageFooter,
} from '@/components/ui/message';
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
  useMessageScroller,
} from '@/components/ui/message-scroller';
import { Unavailable } from '@/components/unavailable';
import { refreshAgentWrites } from '@/lib/agent-writes';
import { type Attachment, imageSource } from '@/lib/attachments';
import { client } from '@/lib/client';
import {
  abortConversation,
  type BranchRequest,
  cancelSubmission,
  contentText,
  conversationsQueryKey,
  type Fork,
  type Gap,
  readConversation,
  sendMessage,
  useBranch,
  useConversation,
  useConversationSummary,
  useDraft,
} from '@/lib/conversations';
import { useMediaQuery } from '@/lib/media';
import {
  type ModelChoice,
  type ModelKey,
  setConversationModel,
  usePreferredModel,
} from '@/lib/models';
import { runPhase } from '@/lib/run-phase';
import { cn } from '@/lib/utils';
import {
  CompactionEntry,
  type AgentState,
  type EntryRecord,
  type InboxState,
  type LiveState,
  type RunFailureReason,
  type TranscriptItem,
} from '@earendil-works/pi-durable';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  LoaderCircle,
  Pencil,
  X,
} from 'lucide-react';
import {
  type KeyboardEvent,
  memo,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import TextareaAutosize from 'react-textarea-autosize';
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

function focusAtEnd(element: HTMLTextAreaElement | null) {
  element?.focus();
  element?.setSelectionRange(element.value.length, element.value.length);
}

function EditMessage({
  initial,
  onCancel,
  onSubmit,
}: {
  initial: string;
  onCancel: () => void;
  onSubmit: ((content: string) => void) | undefined;
}) {
  const [value, setValue] = useState(initial);
  const touch = useMediaQuery('(pointer: coarse)');

  const content = value.trim();

  const send = () => {
    if (content && onSubmit) {
      onSubmit(content);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Escape') {
      onCancel();
    }

    if (
      event.key === 'Enter' &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing &&
      !touch
    ) {
      event.preventDefault();
      send();
    }
  };

  return (
    <form
      aria-label='Edit message'
      className='flex w-full flex-col gap-2 rounded-2xl bg-muted p-3'
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
    >
      <TextareaAutosize
        aria-label='Message'
        className='resize-none bg-transparent px-1 text-base leading-relaxed outline-none'
        maxRows={12}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={onKeyDown}
        ref={focusAtEnd}
        value={value}
      />
      <div className='flex justify-end gap-2'>
        <Button onClick={onCancel} size='sm' type='button' variant='ghost'>
          Cancel
        </Button>
        <Button disabled={!content || !onSubmit} size='sm' type='submit'>
          Send
        </Button>
      </div>
    </form>
  );
}

type Versions = { chats: readonly number[]; index: number };

function VersionLink({
  children,
  id,
  label,
}: {
  children: ReactNode;
  id: number | undefined;
  label: string;
}) {
  if (id === undefined) {
    return (
      <Button aria-label={label} disabled size='icon-xs' variant='ghost'>
        {children}
      </Button>
    );
  }

  return (
    <Button asChild size='icon-xs' variant='ghost'>
      <Link aria-label={label} params={{ id }} to='/c/$id'>
        {children}
      </Link>
    </Button>
  );
}

function VersionSwitcher({ chats, index }: Versions) {
  return (
    <nav
      aria-label='Versions'
      className='flex items-center gap-0.5 text-xs text-muted-foreground tabular-nums'
    >
      <VersionLink id={chats[index - 1]} label='Previous version'>
        <ChevronLeft aria-hidden='true' />
      </VersionLink>
      <span>
        {index + 1} / {chats.length}
      </span>
      <VersionLink id={chats[index + 1]} label='Next version'>
        <ChevronRight aria-hidden='true' />
      </VersionLink>
    </nav>
  );
}

function UserMessage({
  bubble,
  editable = false,
  onEdit,
  versions,
}: {
  bubble: Bubble;
  editable?: boolean;
  onEdit?: (content: string) => void;
  versions?: ReactNode;
}) {
  const [editing, setEditing] = useState(false);

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
        {editing && (
          <EditMessage
            initial={bubble.text}
            onCancel={() => setEditing(false)}
            onSubmit={onEdit}
          />
        )}
        {!editing && bubble.text && (
          <Bubble align='end' variant='muted'>
            <BubbleContent className='rounded-2xl px-4 text-base whitespace-pre-wrap'>
              {bubble.text}
            </BubbleContent>
          </Bubble>
        )}
        {!editing && (editable || versions) && (
          <MessageFooter className='min-h-8 gap-0.5 px-0'>
            {onEdit && (
              <div className='opacity-0 transition-opacity group-hover/message:opacity-100 focus-within:opacity-100'>
                <Action label='Edit' onClick={() => setEditing(true)}>
                  <Pencil aria-hidden='true' className='size-4' />
                </Action>
              </div>
            )}
            {versions}
          </MessageFooter>
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
      entryId?: number;
      key: string;
      kind: 'assistant';
      model?: ModelKey;
      parts: Parameters<typeof AssistantMessage>[0]['parts'];
      span?: Span;
      streaming?: boolean;
    }
  | { bubble: Bubble; entryId: number; key: string; kind: 'user' }
  | { key: string; kind: 'compaction' };

export type Span = { end: number; start: number };

function joined(first: Span | undefined, second: Span | undefined) {
  if (!first || !second) {
    return first ?? second;
  }

  return {
    end: Math.max(first.end, second.end),
    start: Math.min(first.start, second.start),
  };
}

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
    const span = {
      end: message.timestamp + (message.durationMs ?? 0),
      start: message.timestamp,
    };

    const model = { id: message.model, provider: message.provider };

    return visible(message.content)
      ? [
          {
            entryId: item.entry.id,
            key,
            kind: 'assistant',
            model,
            parts: message.content,
            span,
          },
        ]
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

  return [
    {
      bubble: { files, id: key, images, text },
      entryId: item.entry.id,
      key,
      kind: 'user',
    },
  ];
}

function ownsPlan(row: Row, callId: string | null | undefined) {
  return (
    row.kind === 'assistant' &&
    row.parts.some((part) => part.type === 'toolCall' && part.id === callId)
  );
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
        span: joined(last.span, row.span),
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

function versionRows(
  rows: readonly Row[],
  forks: readonly Fork[],
  current: number
) {
  const placed = new Map<Row, Versions>();

  for (const { after, chats } of forks) {
    const index = rows.findIndex(
      (row) =>
        (row.kind === 'assistant' || row.kind === 'user') &&
        row.entryId !== undefined &&
        row.entryId > (after ?? 0)
    );

    const row = rows[index];
    const previous = rows[index - 1];

    if (row && previous?.kind !== 'earlier' && previous?.kind !== 'gap') {
      placed.set(row, { chats, index: chats.indexOf(current) });
    }
  }

  return placed;
}

const TranscriptRow = memo(function TranscriptRow({
  activity,
  failed,
  failure,
  latest,
  loading,
  onBranch,
  onEarlier,
  onGap,
  plan,
  progress,
  results,
  row,
  versions,
  working,
}: {
  activity: string | undefined;
  failed: boolean;
  failure: RunFailureReason | undefined;
  latest: boolean;
  loading: boolean;
  onBranch: ((request: BranchRequest) => void) | undefined;
  onEarlier: () => void;
  onGap: (gap: Gap) => void;
  plan: ShownPlan | undefined;
  progress: ReadonlyMap<string, ToolProgress>;
  results: ReadonlyMap<string, ToolResult>;
  row: Row;
  versions: Versions | undefined;
  working: boolean;
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
    const load = () => (row.kind === 'gap' ? onGap(row.gap) : onEarlier());

    if (failed) {
      return (
        <div className='flex justify-center'>
          <Button disabled={loading} onClick={load} size='sm' variant='ghost'>
            {row.kind === 'gap'
              ? 'Load missing messages'
              : 'Load earlier messages'}
          </Button>
        </div>
      );
    }

    return (
      <div className='flex h-8 items-center justify-center'>
        {loading ? (
          <LoaderCircle
            aria-label='Loading messages'
            className='size-4 text-muted-foreground motion-safe:animate-spin'
          />
        ) : (
          <LoadMore onLoadMore={load} />
        )}
      </div>
    );
  }

  const switcher = versions && <VersionSwitcher {...versions} />;

  if (row.kind === 'assistant') {
    const { entryId } = row;

    const retry =
      onBranch && entryId !== undefined
        ? (model?: ModelChoice) => onBranch({ entryId, kind: 'retry', model })
        : undefined;

    return (
      <AssistantMessage
        activity={activity}
        failure={failure}
        latest={latest}
        model={row.model}
        onRetry={retry}
        parts={row.parts}
        plan={plan}
        progress={progress}
        results={results}
        span={row.span}
        streaming={row.streaming ?? false}
        versions={switcher}
        working={working}
      />
    );
  }

  return (
    <UserMessage
      bubble={row.bubble}
      editable
      onEdit={
        onBranch &&
        ((content) => onBranch({ content, entryId: row.entryId, kind: 'edit' }))
      }
      versions={switcher}
    />
  );
});

export function Conversation({ id }: { id: number }) {
  const summary = useConversationSummary(id);

  if (summary.isError) {
    return <Unavailable subject='chat' />;
  }

  return (
    <MessageScrollerProvider>
      <ConversationView id={id} />
    </MessageScrollerProvider>
  );
}

const EAGER_ROWS = 6;

const noForks: Fork[] = [];

function ConversationView({ id }: { id: number }) {
  const { scrollToEnd } = useMessageScroller();
  const {
    view,
    status: activity,
    plan,
    loadEarlier,
    fillGap,
  } = useConversation(id);
  const summary = useConversationSummary(id);
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

  const branch = useBranch(id);

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

  const forks = summary.data?.forks ?? noForks;

  const versions = useMemo(
    () => versionRows(committed, forks, id),
    [committed, forks, id]
  );

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
        span: last.row.span,
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

  const queued = (inbox?.items ?? []).flatMap((item) => {
    if (item.mode === 'write') {
      return [];
    }

    const bubble = { id: `queued-${item.id}`, text: contentText(item.content) };

    return [{ bubble, submission: Number(item.id) }];
  });

  const phase = runPhase(live, answering);

  const running = phase.kind !== 'idle';

  const shownPlan = useMemo(
    () =>
      plan && plan.steps.length > 0
        ? { editable: running, steps: plan.steps }
        : undefined,
    [plan, running]
  );

  const onBranch = running || branch.isPending ? undefined : branch.mutate;

  const wasRunning = useRef(running);

  useEffect(() => {
    if (wasRunning.current && !running) {
      void refreshAgentWrites(queryClient);
    }

    wasRunning.current = running;
  }, [queryClient, running]);

  const { mutate: markRead } = useMutation({
    meta: { inlineError: true },
    mutationFn: () => readConversation(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: conversationsQueryKey }),
  });

  useEffect(() => {
    if (!running) {
      markRead();
    }
  }, [markRead, running]);

  const thinking =
    phase.kind === 'thinking' ? (activity ?? 'Thinking') : undefined;

  const last = rows.at(-1)?.row;

  const inline =
    thinking !== undefined && last?.kind === 'assistant' ? last : undefined;

  const failure = live?.runFailure?.reason;

  const failedReply =
    failure !== undefined && last?.kind === 'assistant' ? last : undefined;

  return (
    <div className='flex min-h-0 flex-1 flex-col'>
      <MessageScroller className='flex-1'>
        <MessageScrollerViewport aria-label='Transcript'>
          <MessageScrollerContent
            className='mx-auto max-w-3xl px-6 py-8'
            spacerClassName={cn(!running && 'hidden!')}
          >
            <ToolConversation value={id}>
              <ToolHistory value={history}>
                {rows.map(({ key, row }, index) => (
                  <MessageScrollerItem
                    key={key}
                    eager={index >= rows.length - EAGER_ROWS}
                    messageId={key}
                    scrollAnchor={row === anchor}
                  >
                    <TranscriptRow
                      activity={row === inline ? thinking : undefined}
                      latest={row === latest && !running}
                      failed={earlier.isError || gap.isError}
                      failure={row === failedReply ? failure : undefined}
                      loading={earlier.isPending || gap.isPending}
                      onBranch={onBranch}
                      onEarlier={onEarlier}
                      onGap={onGap}
                      plan={ownsPlan(row, plan?.callId) ? shownPlan : undefined}
                      progress={progress}
                      results={results}
                      row={row}
                      versions={versions.get(row)}
                      working={running && row === last}
                    />
                  </MessageScrollerItem>
                ))}
                {phase.kind === 'retrying' && (
                  <RetryStatus retry={phase.retry} />
                )}
                {thinking !== undefined && inline === undefined && (
                  <Activity status={thinking} />
                )}
                {!running && (live?.compactions?.length ?? 0) > 0 && (
                  <Activity status='Summarizing earlier messages' />
                )}
                {failure !== undefined && failedReply === undefined && (
                  <RunFailure reason={failure} />
                )}
                {queued.map(({ bubble, submission }) => (
                  <QueuedMessage
                    key={bubble.id}
                    bubble={bubble}
                    onCancel={() => cancel.mutate(submission)}
                  />
                ))}
              </ToolHistory>
            </ToolConversation>
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
