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
import { useSteady } from '@/lib/steady';
import { duration } from '@/lib/time';
import type { Part, Span } from '@/lib/transcript';
import { useQuiet } from '@/lib/voice';
import { AnimatePresence, m } from 'motion/react';
import { type ComponentProps, useContext, useState } from 'react';

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
  progress,
  result,
  working,
}: CallProps & { activity: string | undefined }) {
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

  return <Activity mark={answer} status={activity ?? status} />;
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

export function timeWorked(
  span: Span | undefined,
  calls: readonly Call[],
  results: ReadonlyMap<string, ToolResult>
) {
  return (
    span && span.end - span.start - waited(span, waitingSpans(calls, results))
  );
}

export function Worked({
  calls,
  mark,
  progress,
  results,
  worked,
  working,
}: {
  calls: readonly Call[];
  mark: ComponentProps<typeof LiveMark>['state'];
  progress: ReadonlyMap<string, ToolProgress>;
  results: ReadonlyMap<string, ToolResult>;
  worked: number | undefined;
  working: boolean;
}) {
  const statuses = calls.map(({ id }) => callStatus(results.get(id), working));

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
          {calls.map((call) => (
            <ToolStep
              key={call.id}
              call={call}
              progress={progress.get(call.id)}
              result={results.get(call.id)}
              working={working}
            />
          ))}
        </TraceCollapsibleContent>
      </TraceCollapsible>
    </Trace>
  );
}

const STATUS_HOLD_MS = 800;

export function Activity({
  mark = 'thinking',
  status,
}: {
  mark?: 'drift' | 'gulp' | 'thinking';
  status: string;
}) {
  const label = useSteady(status, STATUS_HOLD_MS);

  return (
    <output className='flex items-center gap-2'>
      <TraceIcon>
        <LiveMark className='size-3.5' state={mark} />
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
