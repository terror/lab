import { ApprovalCard, approvalOf } from '@/components/approval-card';
import { Markdown } from '@/components/markdown';
import { ModelPicker } from '@/components/model-picker';
import { Plan } from '@/components/plan';
import {
  failedTitle,
  ToolBody,
  ToolConversation,
  ToolHistory,
  type ToolProgress,
  toolRenderer,
  type ToolResult,
} from '@/components/tools';
import { Button } from '@/components/ui/button';
import { Dot } from '@/components/ui/dot';
import { LiveMark } from '@/components/ui/live-mark';
import {
  Message,
  MessageContent,
  MessageFooter,
} from '@/components/ui/message';
import { StatusIcon } from '@/components/ui/status-icon';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceDescription,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from '@/components/ui/trace';
import { cheerFor, useCheer } from '@/lib/cheer';
import { plural } from '@/lib/format';
import type { ModelChoice } from '@/lib/models';
import { fade, spring } from '@/lib/motion';
import { runFailureTitles } from '@/lib/run-failure';
import { useSteady } from '@/lib/steady';
import { duration } from '@/lib/time';
import type { Part, Span } from '@/lib/transcript';
import { cn } from '@/lib/utils';
import type { RunFailureReason } from '@earendil-works/pi-durable';
import type { PlanStep } from '@lab/server/schemas';
import { Check, Copy, RotateCcw, Shuffle, Square, Volume2 } from 'lucide-react';
import { AnimatePresence, m } from 'motion/react';
import {
  type ComponentProps,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

export type { ToolProgress, ToolResult };

type Segment =
  | { calls: Extract<Part, { type: 'toolCall' }>[]; key: string; kind: 'tools' }
  | { index: number; key: string; kind: 'text'; text: string };

function segments(parts: readonly Part[]) {
  return parts.reduce<Segment[]>((grouped, part, index) => {
    const last = grouped.at(-1);

    if (part.type === 'toolCall') {
      if (last?.kind === 'tools') {
        return [
          ...grouped.slice(0, -1),
          { ...last, calls: [...last.calls, part] },
        ];
      }

      return [...grouped, { calls: [part], key: part.id, kind: 'tools' }];
    }

    if (part.type !== 'text' || !part.text) {
      return grouped;
    }

    return [
      ...grouped,
      { index, key: `text-${index}`, kind: 'text', text: part.text },
    ];
  }, []);
}

type CallStatus = ToolResult['status'] | 'running';

const steps: Record<
  CallStatus,
  { label?: string; line?: 'error' | 'pending' | 'running' }
> = {
  done: {},
  failed: { line: 'error' },
  running: { line: 'running' },
  stopped: { label: 'Stopped', line: 'pending' },
};

type Call = Extract<Part, { type: 'toolCall' }>;

function callStatus(
  result: ToolResult | undefined,
  working: boolean
): CallStatus {
  if (result) {
    return result.status;
  }

  return working ? 'running' : 'stopped';
}

function useToolView(
  call: Call,
  progress: ToolProgress | undefined,
  result: ToolResult | undefined,
  working: boolean
) {
  const history = useContext(ToolHistory);

  const status = callStatus(result, working);

  return {
    active: status === 'running',
    args: call.arguments,
    callId: call.id,
    details: result?.details ?? progress?.details,
    history,
    output: result?.output ?? progress?.output ?? '',
    status,
  };
}

type CallProps = {
  call: Call;
  progress: ToolProgress | undefined;
  result: ToolResult | undefined;
  working: boolean;
};

function ToolStep({
  call,
  progress,
  result,
  tick = false,
  working,
}: CallProps & { tick?: boolean }) {
  const { status, ...view } = useToolView(call, progress, result, working);

  const renderer = toolRenderer(call.name);

  const step = steps[status];

  const summary = step.label ?? renderer.summary?.(view);

  const Icon = renderer.icon;

  const ticked = tick && status === 'done';

  const active = renderer.title({ ...view, active: true });

  const titles: Record<CallStatus, string> = {
    done: renderer.title({ ...view, active: false }),
    failed: failedTitle(active),
    running: active,
    stopped: active,
  };

  return (
    <TraceCollapsible>
      <TraceCollapsibleTrigger>
        <TraceLine className='h-6.5' status={step.line} tick={ticked}>
          <TraceIcon className='relative'>
            {ticked && <Icon aria-hidden='true' className='absolute' />}
            <StatusIcon status={status} />
          </TraceIcon>
          <TraceTitle>{titles[status]}</TraceTitle>
          {summary && (
            <span className='shrink-0 text-muted-foreground/70'>
              · {summary}
            </span>
          )}
        </TraceLine>
      </TraceCollapsibleTrigger>
      <TraceCollapsibleContent className='mt-1.5 mb-2 ml-0 flex flex-col gap-3 border-l-0 pl-0'>
        <ToolBody {...view} name={call.name} />
      </TraceCollapsibleContent>
    </TraceCollapsible>
  );
}

function ToolCards({ call, progress, result, working }: CallProps) {
  const view = useToolView(call, progress, result, working);

  const conversationId = useContext(ToolConversation);

  const approval = approvalOf(view.details);

  const inline = toolRenderer(call.name).inline?.(view);

  return (
    <>
      {approval && (
        <div className='mt-1.5 mb-2'>
          <ApprovalCard
            active={view.active}
            approval={approval}
            callId={call.id}
            conversationId={conversationId}
          />
        </div>
      )}
      {inline && <div className='mt-1.5 mb-2'>{inline}</div>}
    </>
  );
}

function LiveSteps({
  calls,
  progress,
  results,
}: {
  calls: readonly Call[];
  progress: ReadonlyMap<string, ToolProgress>;
  results: ReadonlyMap<string, ToolResult>;
}) {
  const [settled] = useState(() => new Set(calls.map(({ id }) => id)));

  return (
    <Trace className='gap-0'>
      <AnimatePresence initial={false}>
        {calls.map((call) => (
          <m.div
            key={call.id}
            animate={{ opacity: 1, y: 0 }}
            initial={{ opacity: 0, y: 6 }}
            transition={{ ...fade.base, y: spring.snap }}
          >
            <ToolStep
              call={call}
              progress={progress.get(call.id)}
              result={results.get(call.id)}
              tick={!settled.has(call.id)}
              working
            />
          </m.div>
        ))}
      </AnimatePresence>
    </Trace>
  );
}

function StepStatus({
  activity,
  call,
  progress,
  result,
  working,
}: CallProps & { activity: string | undefined }) {
  const view = useToolView(call, progress, result, working);

  const approval = approvalOf(view.details);

  const asking =
    call.name === 'ask_user' ||
    (approval !== undefined && approval.decision === undefined);

  if (view.active && asking) {
    return (
      <output className='flex'>
        <TraceLine>
          <TraceIcon>
            <Dot tone='attention' />
          </TraceIcon>
          <TraceTitle>Waiting for your answer</TraceTitle>
        </TraceLine>
      </output>
    );
  }

  const status = view.active ? toolRenderer(call.name).title(view) : 'Thinking';

  return <Activity status={activity ?? status} />;
}

function waited(span: Span, waits: readonly Span[]) {
  return waits
    .toSorted((first, second) => first.start - second.start)
    .reduce(
      (counted, wait) => {
        const start = Math.max(wait.start, counted.from);
        const end = Math.min(wait.end, span.end);

        if (end <= start) {
          return counted;
        }

        return { from: end, total: counted.total + end - start };
      },
      { from: span.start, total: 0 }
    ).total;
}

function waitingSpans(
  calls: readonly Call[],
  results: ReadonlyMap<string, ToolResult>
) {
  return calls.flatMap((call) => {
    const result = results.get(call.id);

    const asked =
      call.name === 'ask_user' || approvalOf(result?.details) !== undefined;

    return asked && result?.span ? [result.span] : [];
  });
}

export function Worked({
  children,
  mark,
  statuses,
  worked,
}: {
  children: ReactNode;
  mark: ComponentProps<typeof LiveMark>['state'];
  statuses: readonly CallStatus[];
  worked: number | undefined;
}) {
  const failed = statuses.filter((status) => status === 'failed').length;

  const stopped = statuses.filter((status) => status === 'stopped').length;

  return (
    <Trace className='gap-0'>
      <TraceCollapsible>
        <TraceCollapsibleTrigger>
          <TraceLine className='h-6.5'>
            {mark && (
              <TraceIcon>
                <LiveMark className='size-3.5' state={mark} />
              </TraceIcon>
            )}
            <TraceTitle>
              {worked === undefined
                ? 'Worked'
                : `Worked for ${duration(worked)}`}
            </TraceTitle>
            <TraceDescription className='text-muted-foreground'>
              {` · ${plural(statuses.length, 'action')}`}
              {failed > 0 && (
                <>
                  {' · '}
                  <span className='text-destructive'>{failed} failed</span>
                </>
              )}
              {stopped > 0 && ` · ${stopped} stopped`}
            </TraceDescription>
          </TraceLine>
        </TraceCollapsibleTrigger>
        <TraceCollapsibleContent className='flex flex-col gap-1'>
          {children}
        </TraceCollapsibleContent>
      </TraceCollapsible>
    </Trace>
  );
}

function plain(markdown: string) {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`#>~|]/g, '');
}

export function Action({
  children,
  label,
  ...props
}: ComponentProps<'button'> & { label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-label={label}
          size='icon'
          type='button'
          variant='quiet'
          {...props}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function CopyAction({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return undefined;
    }

    const timer = window.setTimeout(() => setCopied(false), 1_500);

    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <Action
      label={copied ? 'Copied' : 'Copy'}
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => setCopied(true));
      }}
    >
      {copied ? (
        <Check aria-hidden='true' className='size-4' />
      ) : (
        <Copy aria-hidden='true' className='size-4' />
      )}
    </Action>
  );
}

function SpeakAction({ text }: { text: string }) {
  const [speaking, setSpeaking] = useState(false);
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(
    () => () => {
      if (utterance.current) {
        window.speechSynthesis.cancel();
      }
    },
    []
  );

  const toggle = () => {
    window.speechSynthesis.cancel();

    if (speaking) {
      return;
    }

    const next = new SpeechSynthesisUtterance(plain(text));

    const done = () => {
      if (utterance.current === next) {
        utterance.current = null;
        setSpeaking(false);
      }
    };

    next.addEventListener('end', done);
    next.addEventListener('error', done);

    utterance.current = next;
    setSpeaking(true);
    window.speechSynthesis.speak(next);
  };

  return (
    <Action label={speaking ? 'Stop reading' : 'Read aloud'} onClick={toggle}>
      {speaking ? (
        <Square aria-hidden='true' className='size-3.5 fill-current' />
      ) : (
        <Volume2 aria-hidden='true' className='size-4' />
      )}
    </Action>
  );
}

type Retry = (model?: ModelChoice) => void;

function RetryActions({
  model,
  onRetry,
}: {
  model: ModelChoice | undefined;
  onRetry: Retry;
}) {
  return (
    <>
      <Action label='Retry' onClick={() => onRetry()}>
        <RotateCcw aria-hidden='true' className='size-4' />
      </Action>
      <ModelPicker
        onChange={onRetry}
        trigger={
          <Action label='Retry with another model'>
            <Shuffle aria-hidden='true' className='size-4' />
          </Action>
        }
        value={model}
      />
    </>
  );
}

function MessageActions({
  latest,
  model,
  onRetry,
  text,
  versions,
}: {
  latest: boolean;
  model: ModelChoice | undefined;
  onRetry: Retry | undefined;
  text: string;
  versions: ReactNode;
}) {
  return (
    <MessageFooter className='gap-0.5 px-0'>
      {versions}
      <div
        className={cn(
          'flex items-center gap-0.5 transition-opacity',
          !latest && 'hover-reveal group-hover/message:opacity-100'
        )}
      >
        {text && <CopyAction text={text} />}
        {text && 'speechSynthesis' in window && <SpeakAction text={text} />}
        {onRetry && <RetryActions model={model} onRetry={onRetry} />}
      </div>
    </MessageFooter>
  );
}

const STATUS_HOLD_MS = 800;

export function Activity({ status }: { status: string }) {
  const label = useSteady(status, STATUS_HOLD_MS);

  return (
    <output className='flex items-center gap-2'>
      <TraceIcon>
        <LiveMark className='size-3.5' state='thinking' />
      </TraceIcon>
      <AnimatePresence initial={false} mode='wait'>
        <m.span
          key={label}
          animate={{ opacity: 1, y: 0 }}
          className='min-w-0'
          exit={{ opacity: 0, y: -4 }}
          initial={{ opacity: 0, y: 4 }}
          transition={{ ...fade.base, y: spring.snap }}
        >
          <TraceLine status='running'>
            <TraceTitle>{label}</TraceTitle>
          </TraceLine>
        </m.span>
      </AnimatePresence>
    </output>
  );
}

export function RunFailure({ reason }: { reason: RunFailureReason }) {
  const stopped = reason === 'aborted';

  return (
    <TraceLine role='alert' status={stopped ? undefined : 'error'}>
      <TraceIcon>
        <StatusIcon status={stopped ? 'stopped' : 'failed'} />
      </TraceIcon>
      <TraceTitle>{runFailureTitles[reason]}</TraceTitle>
    </TraceLine>
  );
}

export function replyText(parts: readonly Part[]) {
  return parts
    .slice(parts.findLastIndex(({ type }) => type === 'toolCall') + 1)
    .flatMap((part) => (part.type === 'text' && part.text ? [part.text] : []))
    .join('\n\n');
}

function Segments({
  parts,
  progress,
  results,
  segments: list,
  streaming,
  working,
}: {
  parts: readonly Part[];
  progress: ReadonlyMap<string, ToolProgress>;
  results: ReadonlyMap<string, ToolResult>;
  segments: readonly Segment[];
  streaming: boolean;
  working: boolean;
}) {
  return list.map((segment) => {
    if (segment.kind === 'tools') {
      return segment.calls.map((call) => (
        <ToolCards
          key={call.id}
          call={call}
          progress={progress.get(call.id)}
          result={results.get(call.id)}
          working={working}
        />
      ));
    }

    return (
      <Markdown
        key={segment.key}
        streaming={streaming && segment.index === parts.length - 1}
      >
        {segment.text}
      </Markdown>
    );
  });
}

export type ShownPlan = { editable: boolean; steps: readonly PlanStep[] };

export function AssistantMessage({
  activity,
  failure,
  latest = false,
  model,
  onRetry,
  parts,
  plan,
  progress,
  results,
  span,
  streaming,
  versions,
  working = false,
}: {
  activity?: string;
  failure?: RunFailureReason;
  latest?: boolean;
  model?: ModelChoice;
  onRetry?: Retry;
  parts: readonly Part[];
  plan?: ShownPlan;
  progress: ReadonlyMap<string, ToolProgress>;
  results: ReadonlyMap<string, ToolResult>;
  span?: Span;
  streaming: boolean;
  versions?: ReactNode;
  working?: boolean;
}) {
  const cheer = useCheer(working);

  const text = replyText(parts);

  const answer = !streaming && (text.length > 0 || failure !== undefined);

  const all = segments(parts);

  const split = all.findLastIndex(({ kind }) => kind === 'tools') + 1;

  const calls = all
    .slice(0, split)
    .flatMap((segment) => (segment.kind === 'tools' ? segment.calls : []));

  const replying = all.slice(split).some(({ kind }) => kind === 'text');

  const last = calls.at(-1);

  const current = calls.findLast(({ id }) => !results.has(id)) ?? last;

  const inSlot = current !== undefined && !replying;

  const live = working && !replying;

  const finished = calls.filter(({ id }) => results.has(id));

  const shared = { parts, progress, results, streaming, working };

  const worked =
    span && span.end - span.start - waited(span, waitingSpans(calls, results));

  const marks = {
    cheer: cheerFor(worked ?? 0, calls.length),
    held: 'idle',
    rest: 'idle',
    working: 'thinking',
  } as const;

  const marked = working || (latest && failure === undefined);

  return (
    <Message>
      <MessageContent className='gap-3 text-base'>
        <Segments segments={all.slice(0, split)} {...shared} />
        <AnimatePresence initial={false}>
          {live && (
            <m.div
              key='steps'
              animate={{ height: 'auto', opacity: 1 }}
              className={cn(
                '-m-1 overflow-hidden p-1',
                finished.length === 0 && 'hidden'
              )}
              exit={{ height: 0, opacity: 0 }}
              initial={{ height: 0, opacity: 0 }}
              transition={{ ...fade.fast, height: spring.glide }}
            >
              <LiveSteps
                calls={finished}
                progress={progress}
                results={results}
              />
            </m.div>
          )}
        </AnimatePresence>
        {last && !live && (
          <Worked
            mark={marked ? marks[cheer] : undefined}
            statuses={calls.map(({ id }) =>
              callStatus(results.get(id), working)
            )}
            worked={worked}
          >
            {calls.map((call) => (
              <ToolStep
                key={call.id}
                call={call}
                progress={progress.get(call.id)}
                result={results.get(call.id)}
                working={working}
              />
            ))}
          </Worked>
        )}
        {plan && <Plan {...plan} />}
        {inSlot && (working || activity !== undefined) && (
          <StepStatus
            activity={activity}
            call={current}
            progress={progress.get(current.id)}
            result={results.get(current.id)}
            working={working}
          />
        )}
        <Segments segments={all.slice(split)} {...shared} />
        {activity !== undefined && !inSlot && <Activity status={activity} />}
        {failure && <RunFailure reason={failure} />}
        {answer && (
          <MessageActions
            latest={latest}
            model={model}
            onRetry={onRetry}
            text={text}
            versions={versions}
          />
        )}
      </MessageContent>
    </Message>
  );
}
