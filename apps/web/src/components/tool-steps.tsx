import { ApprovalCard, approvalOf } from '@/components/approval-card';
import {
  failedTitle,
  ToolBody,
  ToolConversation,
  ToolHistory,
  type ToolProgress,
  toolRenderer,
  type ToolResult,
} from '@/components/tools';
import { Dot } from '@/components/ui/dot';
import { LiveMark } from '@/components/ui/live-mark';
import { StatusIcon } from '@/components/ui/status-icon';
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
import { useAhem, useAnswer } from '@/lib/asking';
import { plural } from '@/lib/format';
import { fade, spring } from '@/lib/motion';
import { type Clock, usePresence } from '@/lib/presence';
import { NOTABLE_MS, type Step } from '@/lib/spans';
import { useSteady } from '@/lib/steady';
import { duration } from '@/lib/time';
import type { Part } from '@/lib/transcript';
import { cn } from '@/lib/utils';
import { say, useQuiet } from '@/lib/voice';
import { AnimatePresence, m } from 'motion/react';
import {
  type ComponentProps,
  type CSSProperties,
  useContext,
  useState,
} from 'react';

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

const TIMED_MS = NOTABLE_MS / 3;

function took(span: { end: number; start: number } | undefined) {
  return span && span.end - span.start >= TIMED_MS
    ? duration(span.end - span.start)
    : undefined;
}

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

  const time = took(result?.span);

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
          {time && <TraceDescription>· {time}</TraceDescription>}
        </TraceLine>
      </TraceCollapsibleTrigger>
      <TraceCollapsibleContent className='mt-1.5 mb-2 ml-0 flex flex-col gap-3 border-l-0 pl-0'>
        <ToolBody {...view} name={call.name} />
      </TraceCollapsibleContent>
    </TraceCollapsible>
  );
}

export function ToolCards({ call, progress, result, working }: CallProps) {
  const view = useToolView(call, progress, result, working);

  const [live] = useState(view.active);

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
      {inline && (
        <div className='mt-1.5 mb-2' data-arrived={live || undefined}>
          {inline}
        </div>
      )}
    </>
  );
}

export function LiveSteps({
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

export function StepStatus({
  activity,
  call,
  clock,
  progress,
  result,
  working,
}: CallProps & { activity: string | undefined; clock: Clock | undefined }) {
  const view = useToolView(call, progress, result, working);

  const approval = approvalOf(view.details);

  const asking =
    call.name === 'ask_user' ||
    (approval !== undefined && approval.decision === undefined);

  const quiet = useQuiet();

  const waiting = view.active && asking;

  const ahem = useAhem(call.id, waiting && !quiet);

  const answer = useAnswer(waiting && !quiet, approval?.decision === 'denied');

  if (waiting) {
    return (
      <output className='flex'>
        <TraceLine>
          <TraceIcon>
            {quiet ? (
              <Dot tone='attention' />
            ) : (
              <LiveMark
                className='size-3.5'
                state={ahem ? 'ahem' : 'waiting'}
              />
            )}
          </TraceIcon>
          <TraceTitle>Waiting for your answer</TraceTitle>
        </TraceLine>
      </output>
    );
  }

  const status = view.active ? toolRenderer(call.name).title(view) : 'Thinking';

  return (
    <Activity
      clock={clock}
      mark={answer}
      status={activity ?? status}
      tool={view.active}
    />
  );
}

const pauses = { thought: 'Thought', waited: 'Waited on the model' };

function Pause({ kind, span }: Extract<Step, { kind: 'thought' | 'waited' }>) {
  return (
    <TraceLine className='h-6.5'>
      <TraceIcon>
        <span className='size-1 rounded-full bg-muted-foreground/60' />
      </TraceIcon>
      <TraceTitle>{pauses[kind]}</TraceTitle>
      <TraceDescription>· {duration(span.end - span.start)}</TraceDescription>
    </TraceLine>
  );
}

export function Worked({
  mark,
  progress,
  results,
  rows,
  worked,
  working,
}: {
  mark: ComponentProps<typeof LiveMark>['state'];
  progress: ReadonlyMap<string, ToolProgress>;
  results: ReadonlyMap<string, ToolResult>;
  rows: readonly Step[];
  worked: number | undefined;
  working: boolean;
}) {
  const statuses = rows.flatMap((step) =>
    step.kind === 'tool' ? [callStatus(results.get(step.call.id), working)] : []
  );

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
          {rows.map((step) =>
            step.kind === 'tool' ? (
              <ToolStep
                key={step.call.id}
                call={step.call}
                progress={progress.get(step.call.id)}
                result={results.get(step.call.id)}
                working={working}
              />
            ) : (
              <Pause key={step.key} kind={step.kind} span={step.span} />
            )
          )}
        </TraceCollapsibleContent>
      </TraceCollapsible>
    </Trace>
  );
}

const STATUS_HOLD_MS = 800;

const poses = {
  pondering: 'pondering',
  waiting: 'waiting',
  working: 'thinking',
  writing: 'idle',
} as const;

function Aside({ children, className, ...props }: ComponentProps<'span'>) {
  return (
    <span className={cn('relative', className)} {...props}>
      <span aria-hidden='true' className='absolute -left-2'>
        ·
      </span>
      {children}
    </span>
  );
}

export function Activity({
  clock,
  mark,
  status,
  tool = false,
}: {
  clock?: Clock;
  mark?: 'drift' | 'gulp';
  status: string;
  tool?: boolean;
}) {
  const quiet = useQuiet();

  const label = useSteady(status, STATUS_HOLD_MS);

  const { band, elapsed, pose, slow, stall } = usePresence(clock, {
    tool,
    waiting: false,
    writing: false,
  });

  const timed = band === 'summary' || band === 'leave';

  return (
    <div
      data-slot='activity'
      data-stalled={stall > 0 || undefined}
      className='flex min-w-0 items-start gap-2'
      style={{ '--stall': stall } as CSSProperties}
    >
      <TraceIcon className='h-5'>
        <LiveMark className='size-3.5' state={mark ?? poses[pose]} />
      </TraceIcon>
      <div className='flex min-w-0 flex-1 flex-wrap gap-x-3 overflow-x-clip text-sm text-muted-foreground'>
        <div className='flex max-w-full min-w-0 gap-x-3'>
          <output className='relative flex min-w-0'>
            <AnimatePresence initial={false} mode='popLayout'>
              <m.span
                key={label}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  'min-w-0',
                  band === 'mark'
                    ? 'sr-only'
                    : 'animate-in duration-base fade-in'
                )}
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
          {timed && (
            <Aside className='shrink-0 tabular-nums' role='timer'>
              {duration(elapsed)}
            </Aside>
          )}
        </div>
        {slow && <Aside>{say('stall', undefined, { quiet, seed: '' })}</Aside>}
        {band === 'leave' && <Aside>You can leave this</Aside>}
      </div>
    </div>
  );
}
