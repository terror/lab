import { approvalOf } from '@/components/approval-card';
import {
  type Call,
  callStatus,
  Pause,
  resultId,
  stepSummary,
  stepTitle,
  ToolStep,
  toolView,
} from '@/components/tool-steps';
import {
  ToolBody,
  ToolHistory,
  type ToolProgress,
  toolRenderer,
  type ToolResult,
} from '@/components/tools';
import { Dot } from '@/components/ui/dot';
import { LiveMark } from '@/components/ui/live-mark';
import {
  RunLine,
  RunLineChevron,
  RunLineLink,
  RunLineNote,
  RunLineSummary,
  RunLineTime,
  RunLineToggle,
  RunLineVerb,
} from '@/components/ui/run-line';
import {
  TraceCollapsible,
  TraceCollapsibleContent,
} from '@/components/ui/trace';
import { useAhem, useAnswer } from '@/lib/asking';
import { cheerFor, useCheer } from '@/lib/cheer';
import { plural } from '@/lib/format';
import { locate } from '@/lib/locate';
import { fade, spring } from '@/lib/motion';
import { type Clock, presence, usePresence } from '@/lib/presence';
import { type Step, worked } from '@/lib/spans';
import { useSteady } from '@/lib/steady';
import { duration } from '@/lib/time';
import type { Span } from '@/lib/transcript';
import { cn } from '@/lib/utils';
import { say, useQuiet } from '@/lib/voice';
import { AnimatePresence, m } from 'motion/react';
import { type ReactNode, useContext, useEffect, useState } from 'react';

type Results = ReadonlyMap<string, ToolResult>;

type Progress = ReadonlyMap<string, ToolProgress>;

export type Retry = { at: number; error: string };

const HOLD_MS = 800;

const MAX_TALLIES = 3;

const MAX_FACTS = 2;

function useSettled(done: readonly Call[]) {
  const [count, setCount] = useState(done.length);
  const [fresh, setFresh] = useState<Call>();

  if (count !== done.length) {
    setCount(done.length);
    setFresh(done.length > count ? done.at(-1) : undefined);
  }

  useEffect(() => {
    if (fresh === undefined) {
      return undefined;
    }

    const timer = window.setTimeout(() => setFresh(undefined), HOLD_MS);

    return () => window.clearTimeout(timer);
  }, [fresh]);

  return fresh;
}

function tallies(done: readonly Call[]) {
  const counts = new Map<string, number>();

  for (const { name } of done) {
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  return [...counts]
    .flatMap(([name, count]) => {
      const tally = toolRenderer(name).tally;

      return tally ? [tally(count)] : [];
    })
    .slice(0, MAX_TALLIES);
}

function countdown({ at }: Retry, now: number | undefined) {
  if (now === undefined) {
    return undefined;
  }

  const seconds = Math.ceil((at - now) / 1_000);

  return seconds > 0 ? `in ${seconds}s` : 'now';
}

const stages = {
  pondering: 'Thinking',
  waiting: undefined,
  working: 'Working',
  writing: 'Writing',
};

const poses = {
  pondering: 'pondering',
  waiting: 'waiting',
  working: 'thinking',
  writing: 'idle',
} as const;

function LiveLine({
  activity,
  calls,
  clock,
  open,
  progress,
  results,
  retry,
  writing,
}: {
  activity: string | undefined;
  calls: readonly Call[];
  clock: Clock | undefined;
  open: boolean;
  progress: Progress;
  results: Results;
  retry: Retry | undefined;
  writing: boolean;
}) {
  const quiet = useQuiet();

  const history = useContext(ToolHistory);

  const done = calls.filter(({ id }) => results.has(id));

  const current = calls.findLast(({ id }) => !results.has(id));

  const view =
    current &&
    toolView(current, progress.get(current.id), undefined, true, history);

  const approval = approvalOf(view?.details);

  const asking =
    current !== undefined &&
    (current.name === 'ask_user' ||
      (approval !== undefined && approval.decision === undefined));

  const ahem = useAhem(current?.id ?? '', asking && !quiet);

  const answer = useAnswer(asking && !quiet, approval?.decision === 'denied');

  const settled = useSettled(done);

  const { band, elapsed, pose, slow, stall } = usePresence(clock, {
    tool: current !== undefined,
    waiting: asking,
    writing,
  });

  const past = (call: Call | undefined) =>
    call &&
    stepTitle(
      call.name,
      toolView(call, undefined, results.get(call.id), true, history),
      callStatus(results.get(call.id), true)
    );

  const verbs = [
    asking && approval && 'Waiting for your approval',
    asking && 'Waiting for your answer',
    retry && 'Retrying',
    past(settled),
    current && view && stepTitle(current.name, view, 'running'),
    writing && 'Writing',
  ];

  const verb = verbs.find((candidate) => candidate) || (activity ?? 'Thinking');

  const label = useSteady(verb, HOLD_MS);

  const paused = asking || retry !== undefined;

  const timed = (band === 'summary' || band === 'leave') && !paused;

  const stalled = slow && !paused;

  const leave = band === 'leave' && !paused;

  const steps = timed && calls.length > 0;

  const summary = timed && !stalled && !leave ? tallies(done).join(' · ') : '';

  const now = clock && clock.start + clock.waited + elapsed;

  const state = asking && ahem ? 'ahem' : poses[pose];

  return (
    <RunLine
      mark={
        asking && quiet ? (
          <Dot tone='attention' />
        ) : (
          <LiveMark className='size-3.5' state={answer ?? state} />
        )
      }
      stall={stall}
    >
      {(band !== 'mark' || paused) && (
        <AnimatePresence initial={false} mode='popLayout'>
          <m.span
            key={label}
            animate={{ opacity: 1, y: 0 }}
            className='flex min-w-12 shrink-100'
            exit={{ opacity: 0, y: -4 }}
            initial={{ opacity: 0, y: 4 }}
            transition={{ ...fade.base, y: spring.snap }}
          >
            <RunLineVerb
              live={pose === 'pondering' || pose === 'working'}
              tick={label === past(done.at(-1))}
            >
              {label}
            </RunLineVerb>
          </m.span>
        </AnimatePresence>
      )}
      {timed && <RunLineTime>{duration(elapsed)}</RunLineTime>}
      {steps && (
        <RunLineToggle compact>{plural(calls.length, 'step')}</RunLineToggle>
      )}
      {retry && <RunLineNote>{countdown(retry, now)}</RunLineNote>}
      {leave && <RunLineNote>You can leave this</RunLineNote>}
      {stalled && (
        <RunLineNote className='shrink-100'>
          {say('stall', undefined, { quiet, seed: '' })}
        </RunLineNote>
      )}
      {retry && <RunLineSummary>{retry.error}</RunLineSummary>}
      {summary && <RunLineSummary>{summary}</RunLineSummary>}
      {steps && <RunLineChevron open={open} />}
      <output className='sr-only'>
        {retry ? 'Retrying' : (stages[pose] ?? verb)}
      </output>
    </RunLine>
  );
}

function facts(calls: readonly Call[], results: Results) {
  const statuses = calls.map(({ id }) => callStatus(results.get(id), false));

  const yielded = (kind: 'file' | 'source') =>
    calls.filter(
      ({ name }, index) =>
        statuses[index] === 'done' && toolRenderer(name).yields === kind
    );

  const failed = statuses.filter((status) => status === 'failed').length;

  const stopped = statuses.filter((status) => status === 'stopped').length;

  const files = yielded('file');

  const sources = yielded('source').length;

  const found = [
    { count: sources, label: plural(sources, 'source'), rank: 3 },
    {
      count: files.length,
      label: plural(files.length, 'file'),
      rank: 2,
      target: files[0]?.id,
    },
    { count: failed, label: `${failed} failed`, rank: 0, tone: 'error' },
    { count: stopped, label: `${stopped} stopped`, rank: 1 },
  ] as const;

  const kept = new Set(
    found
      .filter(({ count }) => count > 0)
      .toSorted((first, second) => first.rank - second.rank)
      .slice(0, MAX_FACTS)
  );

  return found.filter((fact) => kept.has(fact));
}

function Receipt({
  calls,
  mark,
  onOpen,
  open,
  results,
  single,
  total,
}: {
  calls: readonly Call[];
  mark: ReactNode;
  onOpen: () => void;
  open: boolean;
  results: Results;
  single: boolean;
  total: number | undefined;
}) {
  const history = useContext(ToolHistory);

  const [only] = calls;

  if (single && only) {
    const { status, ...view } = toolView(
      only,
      undefined,
      results.get(only.id),
      false,
      history
    );

    const summary = stepSummary(only.name, view, status);

    return (
      <RunLine mark={mark}>
        <RunLineToggle
          className={cn(status === 'failed' && 'text-destructive')}
          lead
        >
          {stepTitle(only.name, view, status)}
        </RunLineToggle>
        {summary && <RunLineNote>{summary}</RunLineNote>}
        <RunLineChevron open={open} />
      </RunLine>
    );
  }

  return (
    <RunLine mark={mark}>
      <RunLineVerb>
        {total === undefined ? 'Worked' : `Worked for ${duration(total)}`}
      </RunLineVerb>
      <RunLineToggle>{plural(calls.length, 'step')}</RunLineToggle>
      {facts(calls, results).map((fact) => (
        <RunLineLink
          key={fact.label}
          detail={!('tone' in fact)}
          onClick={() => {
            const located =
              'target' in fact &&
              fact.target !== undefined &&
              locate(resultId(fact.target));

            if (!located) {
              onOpen();
            }
          }}
          tone={'tone' in fact ? fact.tone : undefined}
        >
          {fact.label}
        </RunLineLink>
      ))}
      <RunLineChevron open={open} />
    </RunLine>
  );
}

function Detail({ call, results }: { call: Call; results: Results }) {
  const { status: _, ...view } = toolView(
    call,
    undefined,
    results.get(call.id),
    false,
    useContext(ToolHistory)
  );

  return <ToolBody {...view} name={call.name} />;
}

export function Run({
  activity,
  clock,
  failed,
  latest,
  progress,
  results,
  retry,
  span,
  steps,
  working,
  writing,
}: {
  activity: string | undefined;
  clock: Clock | undefined;
  failed: boolean;
  latest: boolean;
  progress: Progress;
  results: Results;
  retry: Retry | undefined;
  span: Span | undefined;
  steps: readonly Step[];
  working: boolean;
  writing: boolean;
}) {
  const quiet = useQuiet();

  const cheer = useCheer(working);

  const [open, setOpen] = useState(false);

  const calls = steps.flatMap((step) =>
    step.kind === 'tool' ? [step.call] : []
  );

  const total = worked(span, calls, results);

  const [only] = calls;

  const single =
    !working && calls.length === 1 && (total ?? 0) < presence.bands.summary;

  const marks = {
    cheer: cheerFor(total ?? 0, calls.length),
    held: 'idle',
    rest: 'idle',
    working: 'idle',
  } as const;

  return (
    <TraceCollapsible onOpenChange={setOpen} open={open}>
      {working ? (
        <LiveLine
          activity={activity}
          calls={calls}
          clock={clock}
          open={open}
          progress={progress}
          results={results}
          retry={retry}
          writing={writing}
        />
      ) : (
        <Receipt
          calls={calls}
          mark={
            !quiet &&
            latest &&
            !failed && <LiveMark className='size-3.5' state={marks[cheer]} />
          }
          onOpen={() => setOpen(true)}
          open={open}
          results={results}
          single={single}
          total={total}
        />
      )}
      <TraceCollapsibleContent className='flex flex-col gap-1'>
        {single && only ? (
          <Detail call={only} results={results} />
        ) : (
          steps.map((step) =>
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
          )
        )}
      </TraceCollapsibleContent>
    </TraceCollapsible>
  );
}

export function Summarizing() {
  return (
    <RunLine mark={<LiveMark className='size-3.5' state='thinking' />}>
      <output className='flex min-w-0'>
        <RunLineVerb live>Summarizing earlier messages</RunLineVerb>
      </output>
    </RunLine>
  );
}
