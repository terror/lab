import { ApprovalCard, approvalOf } from '@/components/approval-card';
import { Markdown } from '@/components/markdown';
import { ModelPicker } from '@/components/model-picker';
import { Plan } from '@/components/plan';
import {
  ToolBody,
  ToolConversation,
  ToolHistory,
  type ToolProgress,
  toolRenderer,
  type ToolResult,
} from '@/components/tools';
import {
  Message,
  MessageContent,
  MessageFooter,
} from '@/components/ui/message';
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
import { plural } from '@/lib/format';
import type { ModelChoice } from '@/lib/models';
import { useSteady } from '@/lib/steady';
import { duration } from '@/lib/time';
import { cn } from '@/lib/utils';
import type { PlanStep } from '@lab/server/schemas';
import {
  Ban,
  Check,
  Copy,
  type LucideIcon,
  RotateCcw,
  Shuffle,
  Square,
  TriangleAlert,
  Volume2,
} from 'lucide-react';
import { AnimatePresence, m } from 'motion/react';
import {
  type ComponentProps,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

type Part =
  | { type: 'text'; text: string }
  | { type: 'thinking'; thinking: string; redacted?: boolean }
  | {
      type: 'toolCall';
      id: string;
      name: string;
      arguments: Record<string, unknown>;
    };

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
  {
    finished: boolean;
    icon?: LucideIcon;
    label?: string;
    line?: 'error' | 'pending' | 'running';
  }
> = {
  done: { finished: true },
  failed: { finished: true, icon: TriangleAlert, line: 'error' },
  running: { finished: false, line: 'running' },
  stopped: { finished: false, icon: Ban, label: 'Stopped', line: 'pending' },
};

type Call = Extract<Part, { type: 'toolCall' }>;

type Span = { end: number; start: number };

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

function ToolStep({ call, progress, result, working }: CallProps) {
  const { status, ...view } = useToolView(call, progress, result, working);

  const renderer = toolRenderer(call.name);

  const step = steps[status];

  const Icon = step.icon ?? renderer.icon;

  const summary = step.label ?? renderer.summary?.(view);

  const title = renderer.title({ ...view, active: !step.finished });

  return (
    <TraceCollapsible>
      <TraceCollapsibleTrigger>
        <TraceLine className='h-6.5' status={step.line}>
          <TraceIcon>
            <Icon aria-hidden='true' />
          </TraceIcon>
          <TraceTitle>{title}</TraceTitle>
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

function StepStatus({
  activity,
  call,
  progress,
  result,
  working,
}: CallProps & { activity: string | undefined }) {
  const view = useToolView(call, progress, result, working);

  return <Activity status={activity ?? toolRenderer(call.name).title(view)} />;
}

export function Worked({
  children,
  span,
  statuses,
}: {
  children: ReactNode;
  span: Span | undefined;
  statuses: readonly CallStatus[];
}) {
  const failed = statuses.filter((status) => status === 'failed').length;

  const stopped = statuses.filter((status) => status === 'stopped').length;

  const details = [
    plural(statuses.length, 'action'),
    failed > 0 ? `${failed} failed` : undefined,
    stopped > 0 ? `${stopped} stopped` : undefined,
  ].filter((detail) => detail !== undefined);

  return (
    <Trace className='gap-0'>
      <TraceCollapsible>
        <TraceCollapsibleTrigger>
          <TraceLine className='h-6.5'>
            <TraceTitle>
              {span
                ? `Worked for ${duration(span.end - span.start)}`
                : 'Worked'}
            </TraceTitle>
            <TraceDescription className='text-muted-foreground'>
              {` · ${details.join(' · ')}`}
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
        <button
          aria-label={label}
          className='flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground'
          type='button'
          {...props}
        >
          {children}
        </button>
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
          !latest &&
            'opacity-0 group-hover/message:opacity-100 focus-within:opacity-100 has-data-[state=open]:opacity-100'
        )}
      >
        <CopyAction text={text} />
        {'speechSynthesis' in window && <SpeakAction text={text} />}
        {onRetry && <RetryActions model={model} onRetry={onRetry} />}
      </div>
    </MessageFooter>
  );
}

const STATUS_HOLD_MS = 800;

export function Activity({ status }: { status: string }) {
  const label = useSteady(status, STATUS_HOLD_MS);

  return (
    <output className='flex'>
      <AnimatePresence initial={false} mode='wait'>
        <m.span
          key={label}
          animate={{ opacity: 1, y: 0 }}
          className='min-w-0'
          exit={{ opacity: 0, y: -4 }}
          initial={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.2 }}
        >
          <TraceLine status='running'>
            <TraceTitle>{label}</TraceTitle>
          </TraceLine>
        </m.span>
      </AnimatePresence>
    </output>
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
  const text = replyText(parts);

  const answer = !streaming && text.length > 0;

  const all = segments(parts);

  const split = all.findLastIndex(({ kind }) => kind === 'tools') + 1;

  const calls = all
    .slice(0, split)
    .flatMap((segment) => (segment.kind === 'tools' ? segment.calls : []));

  const replying = all.slice(split).some(({ kind }) => kind === 'text');

  const last = calls.at(-1);

  const inSlot = last !== undefined && !replying;

  const shared = { parts, progress, results, streaming, working };

  return (
    <Message>
      <MessageContent className='gap-3 text-base'>
        <Segments segments={all.slice(0, split)} {...shared} />
        {inSlot && (working || activity !== undefined) && (
          <StepStatus
            activity={activity}
            call={last}
            progress={progress.get(last.id)}
            result={results.get(last.id)}
            working={working}
          />
        )}
        {last && (!working || replying) && (
          <Worked
            span={span}
            statuses={calls.map(({ id }) =>
              callStatus(results.get(id), working)
            )}
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
        <Segments segments={all.slice(split)} {...shared} />
        {activity !== undefined && !inSlot && <Activity status={activity} />}
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
