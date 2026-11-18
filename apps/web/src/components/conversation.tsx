import {
  AssistantMessage,
  RunFailure,
  replyText,
  type ShownPlan,
  type ToolProgress,
  type ToolResult,
} from '@/components/assistant-message';
import { ChatHeader } from '@/components/chat-header';
import { Composer } from '@/components/composer';
import { ComposerDock } from '@/components/composer-dock';
import { DocumentCard } from '@/components/document-card';
import { FileChip } from '@/components/file-chip';
import { ImageCard } from '@/components/image-card';
import { LoadMore } from '@/components/load-more';
import { Activity } from '@/components/tool-steps';
import { ToolConversation, ToolHistory } from '@/components/tools';
import { Bubble, BubbleContent } from '@/components/ui/bubble';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
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
import { type Attachment } from '@/lib/attachments';
import { useConversation } from '@/lib/conversation-stream';
import {
  abortConversation,
  type BranchRequest,
  cancelSubmission,
  conversationsQueryKey,
  type Fork,
  readConversation,
  sendMessage,
  useBranch,
  useConversationSummary,
  useDraft,
} from '@/lib/conversations';
import { useArrivals } from '@/lib/glide';
import { useMediaQuery } from '@/lib/media';
import {
  type ModelChoice,
  setConversationModel,
  usePreferredModel,
} from '@/lib/models';
import { runPhase } from '@/lib/run-phase';
import {
  type BubbleFile,
  cachedRows,
  type Gap,
  keyRows,
  mergeReplies,
  ownsPlan,
  type Part,
  queuedMessages,
  type Row,
  streamRows,
  toolHistory,
  toolProgress,
  toolResults,
  type UserBubble,
  type Versions,
  versionRows,
  visible,
} from '@/lib/transcript';
import { uploadUrl } from '@/lib/uploads';
import { cn } from '@/lib/utils';
import {
  type AgentState,
  type InboxState,
  type LiveState,
  type RunFailureReason,
} from '@earendil-works/pi-durable';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  ChevronLeft,
  ChevronRight,
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

function AttachedFile({ name, uploadId }: BubbleFile) {
  if (!uploadId) {
    return <FileChip name={name} />;
  }

  if (name.toLowerCase().endsWith('.pdf')) {
    return <DocumentCard name={name} uploadId={uploadId} />;
  }

  return <FileChip href={uploadUrl(uploadId)} name={name} />;
}

function UserMessage({
  bubble,
  editable = false,
  onEdit,
  versions,
}: {
  bubble: UserBubble;
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
              <ImageCard
                key={index}
                className='max-h-48'
                name='Image'
                src={source}
              />
            ))}
          </div>
        )}
        {(bubble.files?.length ?? 0) > 0 && (
          <div className='flex flex-wrap justify-end gap-2'>
            {bubble.files?.map((attached, index) => (
              <AttachedFile key={index} {...attached} />
            ))}
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
              <div className='hover-reveal group-hover/message:opacity-100'>
                <IconButton label='Edit' onClick={() => setEditing(true)}>
                  <Pencil aria-hidden='true' className='size-4' />
                </IconButton>
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
  bubble: UserBubble;
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

const noParts: readonly Part[] = [];

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
  retrying,
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
  retrying: boolean;
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
        retrying={retrying}
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

  if (summary.data === null || summary.isLoadingError) {
    return <Unavailable subject='chat' />;
  }

  return (
    <>
      <ChatHeader id={id} />
      <MessageScrollerProvider autoScroll={summary.data?.running !== true}>
        <ConversationView id={id} />
      </MessageScrollerProvider>
    </>
  );
}

const EAGER_ROWS = 6;

const noForks: Fork[] = [];

const ignoreBranch = () => undefined;

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

  const abort = useMutation({
    mutationFn: (_withdrawn: ReturnType<typeof queuedMessages>) =>
      abortConversation(id),
    onSuccess: (_, withdrawn) => {
      if (withdrawn.length === 0) {
        return;
      }

      setDraft(
        [...withdrawn.map(({ bubble }) => bubble.text), draft.trim()]
          .filter(Boolean)
          .join('\n\n')
      );

      setAttachments((current) => [
        ...withdrawn.flatMap((message) => message.attachments),
        ...current,
      ]);
    },
  });

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
    () => toolHistory(committed, results),
    [committed, results]
  );

  const keyed = useMemo(() => keyRows(committed), [committed]);

  const forks = summary.data?.forks ?? noForks;

  const versions = useMemo(
    () => versionRows(committed, forks, id),
    [committed, forks, id]
  );

  const rows = useMemo(() => streamRows(keyed, partial), [keyed, partial]);

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

  const arrived = useArrivals(
    rows.map(({ key }) => key),
    view !== undefined
  );

  const progress = useMemo(() => toolProgress(live?.tools), [live?.tools]);

  const queued = queuedMessages(inbox);

  const phase = runPhase(live, answering);

  const running = phase.kind !== 'idle';

  const shownPlan = useMemo(
    () =>
      plan && plan.steps.length > 0
        ? { editable: running, steps: plan.steps }
        : undefined,
    [plan, running]
  );

  const branching = branch.isPending ? ignoreBranch : branch.mutate;

  const onBranch = running ? undefined : branching;

  const retried =
    branch.isPending && branch.variables.kind === 'retry'
      ? branch.variables.entryId
      : undefined;

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
    if (running) {
      return undefined;
    }

    if (!document.hidden) {
      markRead();

      return undefined;
    }

    const read = () => {
      if (!document.hidden) {
        document.removeEventListener('visibilitychange', read);
        markRead();
      }
    };

    document.addEventListener('visibilitychange', read);

    return () => document.removeEventListener('visibilitychange', read);
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
                    className={cn(
                      row === anchor &&
                        arrived(key) &&
                        'animate-in duration-base fade-in slide-in-from-bottom-1'
                    )}
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
                      retrying={
                        row.kind === 'assistant' &&
                        row.entryId !== undefined &&
                        row.entryId === retried
                      }
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
      <ComposerDock className='mx-auto w-full max-w-3xl px-6 pb-6'>
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
          onStop={() => abort.mutate(queued)}
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
      </ComposerDock>
    </div>
  );
}
