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
import { LoadMore } from '@/components/load-more';
import {
  asks,
  type Retry as Backoff,
  cheerOf,
  Dock,
  RunHead,
  Summarizing,
} from '@/components/run';
import {
  SubagentPane,
  SubagentSplit,
  lanesOf,
} from '@/components/subagent-pane';
import { ToolConversation, ToolHistory } from '@/components/tools';
import { OpenSubagent } from '@/components/tools/delegate';
import { FooterButton } from '@/components/tools/previews';
import { Bubble, BubbleContent } from '@/components/ui/bubble';
import { Button } from '@/components/ui/button';
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
import {
  QueuedMessage,
  UserMessage,
  VersionSwitcher,
} from '@/components/user-message';
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
import { useNote } from '@/lib/hints';
import { useInView } from '@/lib/in-view';
import {
  type ModelChoice,
  setConversationModel,
  usePreferredModel,
} from '@/lib/models';
import { useMoment } from '@/lib/moment';
import type { Clock } from '@/lib/presence';
import { useSlip } from '@/lib/run-failure';
import { runPhase } from '@/lib/run-phase';
import { runTiming, steps } from '@/lib/spans';
import {
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
  type Versions,
  versionRows,
  visible,
} from '@/lib/transcript';
import { cn } from '@/lib/utils';
import {
  type AgentState,
  type InboxState,
  type LiveState,
  type RunFailureReason,
} from '@earendil-works/pi-durable';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { LoaderCircle } from 'lucide-react';
import {
  memo,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

const noParts: readonly Part[] = [];

const TranscriptRow = memo(function TranscriptRow({
  activity,
  backoff,
  clock,
  failed,
  failure,
  hop,
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
  slip,
  versions,
  working,
}: {
  activity: string | undefined;
  backoff: Backoff | undefined;
  clock: Clock | undefined;
  failed: boolean;
  failure: RunFailureReason | undefined;
  hop: 'done' | 'proud' | undefined;
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
  slip: boolean;
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
        backoff={backoff}
        clock={clock}
        failure={failure}
        hop={hop}
        latest={latest}
        model={row.model}
        onRetry={retry}
        parts={row.parts}
        plan={plan}
        progress={progress}
        results={results}
        retrying={retrying}
        rounds={row.rounds}
        slip={slip}
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

export function Conversation({
  agent,
  id,
  onAgent,
}: {
  agent?: number;
  id: number;
  onAgent?: (agent: number | undefined) => void;
}) {
  const summary = useConversationSummary(id);

  const running = summary.data?.running === true;

  const [ran, setRan] = useState(running);

  if (running && !ran) {
    setRan(true);
  }

  if (summary.data === null || summary.isLoadingError) {
    return <Unavailable subject='chat' />;
  }

  return (
    <MessageScrollerProvider autoScroll={!ran}>
      <ConversationView
        header={<ChatHeader id={id} />}
        id={id}
        onSubagent={onAgent}
        subagent={agent}
      />
    </MessageScrollerProvider>
  );
}

const EAGER_ROWS = 6;

const noForks: Fork[] = [];

const ignoreBranch = () => undefined;

type Queued = ReturnType<typeof queuedMessages>;

function useChatComposer(id: number, queued: Queued) {
  const { scrollToEnd } = useMessageScroller();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useDraft(id);
  const [attachments, setAttachments] = useState<Attachment[]>([]);

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
    mutationFn: (_withdrawn: Queued) => abortConversation(id),
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

  const [, setPreferredModel] = usePreferredModel();

  const changeModel = useMutation({
    mutationFn: (model: ModelChoice) => setConversationModel(id, model),
    onSuccess: (_, model) => setPreferredModel(model),
  });

  const submit = (content: string, steer: boolean) => {
    scrollToEnd({ behavior: 'smooth' });
    send.mutate({ content, sent: attachments, steer });
  };

  return {
    attachments,
    draft,
    error: send.error?.message,
    onAttachmentsChange: setAttachments,
    onDraftChange: (value: string) => {
      if (send.isError) {
        send.reset();
      }

      setDraft(value);
    },
    onModelChange: (model: ModelChoice) => changeModel.mutate(model),
    onStop: () => abort.mutate(queued),
    onSteer: (content: string) => submit(content, true),
    onSubmit: (content: string) => submit(content, false),
    submitting: send.isPending,
  };
}

function useRunEnd(id: number, running: boolean) {
  const queryClient = useQueryClient();

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
}

function useTranscript(stream: ReturnType<typeof useConversation>) {
  const { fillGap, loadEarlier, pulse, view } = stream;

  const earlier = useMutation({ mutationFn: loadEarlier });
  const gap = useMutation({ mutationFn: fillGap });

  const live = view?.docs['pi.live'] as LiveState | undefined;

  const partial = live?.generation?.message?.content ?? noParts;

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

  const phase = runPhase(live, visible(partial));

  const running = phase.kind !== 'idle';

  const rows = useMemo(
    () => streamRows(keyed, partial, running),
    [keyed, partial, running]
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

  const progress = useMemo(() => toolProgress(live?.tools), [live?.tools]);

  const first = live?.run?.first;

  const requested = live?.generation?.message?.timestamp;

  const timing = useMemo(
    () =>
      running
        ? runTiming(committed, results, {
            first,
            requested,
            seen: { at: pulse.began, fresh: pulse.fresh },
          })
        : undefined,
    [committed, first, pulse.began, pulse.fresh, requested, results, running]
  );

  const clock = useMemo(
    () =>
      timing && {
        at: pulse.at,
        linked: pulse.open,
        start: timing.start,
        waited: timing.waited,
      },
    [pulse.at, pulse.open, timing]
  );

  const last = rows.at(-1)?.row;

  const failure = live?.runFailure?.reason;

  return {
    busy: running && phase.kind !== 'finishing',
    clock,
    committed,
    earlier,
    failedReply:
      failure !== undefined && last?.kind === 'assistant' ? last : undefined,
    failure,
    gap,
    history,
    last,
    latest: committed.findLast(({ kind }) => kind === 'assistant'),
    live,
    onEarlier,
    onGap,
    phase,
    progress,
    results,
    rows,
    running,
  };
}

function ConversationView({
  header,
  id,
  onSubagent,
  subagent,
}: {
  header: ReactNode;
  id: number;
  onSubagent: ((agent: number | undefined) => void) | undefined;
  subagent: number | undefined;
}) {
  const stream = useConversation(id);

  const { plan, status: activity, view } = stream;

  const {
    busy,
    clock,
    committed,
    earlier,
    failedReply,
    failure,
    gap,
    history,
    last,
    latest,
    live,
    onEarlier,
    onGap,
    phase,
    progress,
    results,
    rows,
    running,
  } = useTranscript(stream);

  const summary = useConversationSummary(id);

  const branch = useBranch(id);

  const cancel = useMutation({
    mutationFn: (submission: number) => cancelSubmission(id, submission),
  });

  const inbox = view?.docs['pi.inbox'] as InboxState | undefined;
  const agent = view?.docs['pi.agent'] as AgentState | undefined;

  const forks = summary.data?.forks ?? noForks;

  const versions = useMemo(
    () => versionRows(committed, forks, id),
    [committed, forks, id]
  );

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

  const anchor = committed.findLast(({ kind }) => kind === 'user');

  const arrived = useArrivals(
    rows.map(({ key }) => key),
    view !== undefined
  );

  const queued = queuedMessages(inbox);

  const composer = useChatComposer(id, queued);

  const shownPlan = useMemo(
    () =>
      plan && plan.steps.length > 0
        ? { editable: running, steps: plan.steps }
        : undefined,
    [plan, running]
  );

  const idle = composer.draft === '';

  const [planned, setPlanned] = useState(false);

  if (
    !planned &&
    running &&
    (plan?.steps.some(({ status }) => status !== 'done') ?? false)
  ) {
    setPlanned(true);
  }

  useNote('plan', planned && idle);

  useNote(
    'versions',
    !running && idle && [...versions.values()].some(({ index }) => index > 0)
  );

  const branching = branch.isPending ? ignoreBranch : branch.mutate;

  const onBranch = running ? undefined : branching;

  const retried =
    branch.isPending && branch.variables.kind === 'retry'
      ? branch.variables.entryId
      : undefined;

  useRunEnd(id, running);

  const slipped = useSlip(running, failure);

  const slip = useMoment('run.slip', { when: slipped }).on && slipped;

  const [head, setHead] = useState<HTMLElement | null>(null);

  const seen = useInView(head);

  const reply = last?.kind === 'assistant' ? last : undefined;

  const ledger = useMemo(
    () => (reply ? steps(reply.parts, reply.rounds ?? [], results) : []),
    [reply, results]
  );

  const activityNow = phase.kind === 'thinking' ? activity : undefined;

  const backoff = phase.kind === 'retrying' ? phase.retry : undefined;

  const hop = useMoment(
    failure === undefined ? cheerOf(ledger, reply?.span, results) : undefined,
    { when: !busy }
  );

  const docked = busy
    ? !seen || asks(ledger, progress, results)
    : hop.on && !seen;

  const opener = useMemo(
    () => onSubagent && { open: onSubagent, shown: subagent },
    [onSubagent, subagent]
  );

  const pane = subagent !== undefined && onSubagent && (
    <SubagentPane
      agent={subagent}
      lanes={lanesOf(subagent, results, progress)}
      onClose={() => onSubagent(undefined)}
      onOpen={onSubagent}
    >
      <SubagentThread key={subagent} agent={subagent} id={id} />
    </SubagentPane>
  );

  return (
    <OpenSubagent value={opener}>
      <SubagentSplit onClose={() => onSubagent?.(undefined)} pane={pane}>
        {header}
        <div className='flex min-h-0 flex-1 flex-col'>
          <MessageScroller className='flex-1'>
            <MessageScrollerViewport aria-label='Transcript'>
              <MessageScrollerContent
                className='mx-auto max-w-3xl px-6 py-8'
                spacerClassName={cn(!running && 'hidden!')}
              >
                <ToolConversation value={id}>
                  <ToolHistory value={history}>
                    <RunHead value={setHead}>
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
                            activity={row === last ? activityNow : undefined}
                            backoff={row === last ? backoff : undefined}
                            hop={row === latest && seen ? hop.mark : undefined}
                            clock={busy && row === last ? clock : undefined}
                            latest={row === latest && !busy}
                            failed={earlier.isError || gap.isError}
                            failure={row === failedReply ? failure : undefined}
                            loading={earlier.isPending || gap.isPending}
                            onBranch={onBranch}
                            onEarlier={onEarlier}
                            onGap={onGap}
                            plan={
                              ownsPlan(row, plan?.callId)
                                ? shownPlan
                                : undefined
                            }
                            progress={progress}
                            results={results}
                            retrying={
                              row.kind === 'assistant' &&
                              row.entryId !== undefined &&
                              row.entryId === retried
                            }
                            row={row}
                            slip={row === failedReply && slip}
                            versions={versions.get(row)}
                            working={busy && row === last}
                          />
                        </MessageScrollerItem>
                      ))}
                      {!running && (live?.compactions?.length ?? 0) > 0 && (
                        <Summarizing />
                      )}
                      {failure !== undefined && failedReply === undefined && (
                        <RunFailure
                          mark={slip ? 'error' : 'broken'}
                          reason={failure}
                        />
                      )}
                      {queued.map(({ bubble, submission }) => (
                        <QueuedMessage
                          key={bubble.id}
                          bubble={bubble}
                          onCancel={() => cancel.mutate(submission)}
                        />
                      ))}
                    </RunHead>
                  </ToolHistory>
                </ToolConversation>
              </MessageScrollerContent>
            </MessageScrollerViewport>
            <MessageScrollerButton
              className='rounded-full shadow-md ring-1 ring-foreground/10'
              size='icon'
            />
          </MessageScroller>
          <ComposerDock className='relative mx-auto w-full max-w-3xl px-6 pb-6'>
            <ToolHistory value={history}>
              <Dock
                activity={activityNow}
                clock={clock}
                hop={hop.mark}
                onJump={() => head?.scrollIntoView({ block: 'center' })}
                progress={progress}
                results={results}
                retry={backoff}
                shown={docked}
                span={reply?.span}
                steps={ledger}
                working={busy}
                writing={
                  reply?.streaming === true &&
                  reply.parts.at(-1)?.type === 'text'
                }
              />
            </ToolHistory>
            <Composer
              {...composer}
              commandContext={commandContext}
              disabled={view === undefined}
              model={
                agent?.model && {
                  id: agent.model.modelId,
                  provider: agent.model.provider,
                  thinkingLevel: agent.thinkingLevel,
                }
              }
              running={running}
              tips
            />
          </ComposerDock>
        </div>
      </SubagentSplit>
    </OpenSubagent>
  );
}

function Brief({ text }: { text: string }) {
  const [whole, setWhole] = useState(false);

  const [clamped, setClamped] = useState(false);

  const measure = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      setClamped(node.scrollHeight > node.clientHeight);
    }
  }, []);

  return (
    <div className='flex flex-col items-end gap-1.5'>
      <span className='px-1 text-xs text-muted-foreground'>Brief from Lab</span>
      <Bubble align='end' variant='muted'>
        <BubbleContent
          className={cn(
            'rounded-2xl px-4 whitespace-pre-wrap',
            !whole && 'line-clamp-4'
          )}
          ref={measure}
        >
          {text}
        </BubbleContent>
      </Bubble>
      {(clamped || whole) && (
        <FooterButton onClick={() => setWhole(!whole)}>
          {whole ? 'Show less' : 'Show the whole brief'}
        </FooterButton>
      )}
    </div>
  );
}

function SubagentThread({ agent, id }: { agent: number; id: number }) {
  const stream = useConversation(id, agent);

  const {
    busy,
    clock,
    earlier,
    failedReply,
    failure,
    gap,
    history,
    last,
    live,
    onEarlier,
    onGap,
    phase,
    progress,
    results,
    rows,
    running,
  } = useTranscript(stream);

  const activity = phase.kind === 'thinking' ? stream.status : undefined;

  const backoff = phase.kind === 'retrying' ? phase.retry : undefined;

  return (
    <MessageScrollerProvider>
      <MessageScroller className='flex-1'>
        <MessageScrollerViewport aria-label='Subagent transcript'>
          <MessageScrollerContent
            className='px-6 py-6'
            spacerClassName={cn(!running && 'hidden!')}
          >
            <ToolConversation value={agent}>
              <ToolHistory value={history}>
                {rows.map(({ key, row }) => (
                  <MessageScrollerItem
                    key={key}
                    eager={row.kind === 'user'}
                    messageId={key}
                  >
                    {row.kind === 'user' ? (
                      <Brief text={row.bubble.text} />
                    ) : (
                      <TranscriptRow
                        activity={row === last ? activity : undefined}
                        backoff={row === last ? backoff : undefined}
                        clock={busy && row === last ? clock : undefined}
                        failed={earlier.isError || gap.isError}
                        failure={row === failedReply ? failure : undefined}
                        hop={undefined}
                        latest={false}
                        loading={earlier.isPending || gap.isPending}
                        onBranch={undefined}
                        onEarlier={onEarlier}
                        onGap={onGap}
                        plan={undefined}
                        progress={progress}
                        results={results}
                        retrying={false}
                        row={row}
                        slip={false}
                        versions={undefined}
                        working={busy && row === last}
                      />
                    )}
                  </MessageScrollerItem>
                ))}
                {!running && (live?.compactions?.length ?? 0) > 0 && (
                  <Summarizing />
                )}
                {failure !== undefined && failedReply === undefined && (
                  <RunFailure reason={failure} />
                )}
              </ToolHistory>
            </ToolConversation>
          </MessageScrollerContent>
        </MessageScrollerViewport>
      </MessageScroller>
    </MessageScrollerProvider>
  );
}
