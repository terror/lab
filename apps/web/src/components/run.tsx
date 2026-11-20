import { approvalOf } from '@/components/approval-card';
import {
  approvalId,
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
import { text } from '@/components/tools/format';
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
  RunTab,
} from '@/components/ui/run-line';
import {
  TraceCollapsible,
  TraceCollapsibleContent,
} from '@/components/ui/trace';
import { useAhem, useAnswer } from '@/lib/asking';
import { cheerFor } from '@/lib/cheer';
import { plural } from '@/lib/format';
import { locate } from '@/lib/locate';
import { useMoment } from '@/lib/moment';
import { fade, spring } from '@/lib/motion';
import { type Clock, presence, usePresence } from '@/lib/presence';
import { type Step, worked } from '@/lib/spans';
import { useSteady } from '@/lib/steady';
import { duration } from '@/lib/time';
import type { Span } from '@/lib/transcript';
import { cn } from '@/lib/utils';
import { say, useQuiet } from '@/lib/voice';
import { AnimatePresence, m } from 'motion/react';
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';

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

type Live = {
  activity: string | undefined;
  calls: readonly Call[];
  clock: Clock | undefined;
  progress: Progress;
  results: Results;
  retry: Retry | undefined;
  writing: boolean;
};

function useLive({
  activity,
  calls,
  clock,
  progress,
  results,
  retry,
  writing,
}: Live) {
  const quiet = useQuiet();

  const history = useContext(ToolHistory);

  const done = calls.filter(({ id }) => results.has(id));

  const current = calls.findLast(({ id }) => !results.has(id));

  const view =
    current &&
    toolView(current, progress.get(current.id), undefined, true, history);

  const approval = approvalOf(view?.details);

  const pending = approval !== undefined && approval.decision === undefined;

  const asking =
    current !== undefined && (current.name === 'ask_user' || pending);

  const ahem = useAhem(current?.id ?? '', asking && !quiet);

  const answer = useAnswer(asking && !quiet, approval?.decision === 'denied');

  const settled = useSettled(done);

  const shown = usePresence(clock, {
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
    asking && pending && 'Waiting for your approval',
    asking && 'Waiting for your answer',
    retry && 'Retrying',
    past(settled),
    current && view && stepTitle(current.name, view, 'running'),
    writing && 'Writing',
  ];

  const verb = verbs.find((candidate) => candidate) || (activity ?? 'Thinking');

  const label = useSteady(verb, HOLD_MS);

  const state = asking && ahem ? 'ahem' : poses[shown.pose];

  const asked = pending ? approval.action : text(current?.arguments.question);

  const anchor = pending ? approvalId : resultId;

  return {
    ...shown,
    asking,
    done,
    label,
    mark:
      asking && quiet ? (
        <Dot tone='attention' />
      ) : (
        <LiveMark className='size-3.5' state={answer ?? state} />
      ),
    paused: asking || retry !== undefined,
    prompt: asking ? asked : undefined,
    target: asking && current ? anchor(current.id) : undefined,
    tick: label === past(done.at(-1)),
    verb,
  };
}

function Verb({
  label,
  live,
  tick,
}: {
  label: string;
  live: boolean;
  tick: boolean;
}) {
  return (
    <AnimatePresence initial={false} mode='popLayout'>
      <m.span
        key={label}
        animate={{ opacity: 1, y: 0 }}
        className='flex min-w-12 shrink-100'
        exit={{ opacity: 0, y: -4 }}
        initial={{ opacity: 0, y: 4 }}
        transition={{ ...fade.base, y: spring.snap }}
      >
        <RunLineVerb live={live} tick={tick}>
          {label}
        </RunLineVerb>
      </m.span>
    </AnimatePresence>
  );
}

function LiveLine({ open, ...run }: Live & { open: boolean }) {
  const voiced = useMoment('chat.thinking');

  const { calls, clock, retry } = run;

  const {
    band,
    done,
    elapsed,
    label,
    mark,
    paused,
    pose,
    slow,
    stall,
    tick,
    verb,
  } = useLive(run);

  const timed = (band === 'summary' || band === 'leave') && !paused;

  const stalled = slow && !paused;

  const leave = band === 'leave' && !paused;

  const steps = timed && calls.length > 0;

  const summary = timed && !stalled && !leave ? tallies(done).join(' · ') : '';

  const now = clock && clock.start + clock.waited + elapsed;

  return (
    <RunLine mark={mark} stall={stall}>
      {(band !== 'mark' || paused) && (
        <Verb
          label={label}
          live={pose === 'pondering' || pose === 'working'}
          tick={tick}
        />
      )}
      {timed && <RunLineTime>{duration(elapsed)}</RunLineTime>}
      {steps && (
        <RunLineToggle compact>{plural(calls.length, 'step')}</RunLineToggle>
      )}
      {retry && <RunLineNote>{countdown(retry, now)}</RunLineNote>}
      {leave && <RunLineNote>You can leave this</RunLineNote>}
      {stalled && (
        <RunLineNote className='shrink-10000'>
          {say('stall', undefined, { quiet: !voiced.on, seed: '' })}
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

function DockLive({ onJump, ...run }: Live & { onJump: () => void }) {
  const {
    asking,
    band,
    elapsed,
    label,
    mark,
    paused,
    pose,
    prompt,
    stall,
    target,
    tick,
  } = useLive(run);

  const timed = (band === 'summary' || band === 'leave') && !paused;

  if (asking) {
    return (
      <RunTab
        aria-label={['Needs you', prompt].filter(Boolean).join(': ')}
        onClick={() => {
          if (!(target && locate(target))) {
            onJump();
          }
        }}
      >
        <RunLine mark={mark}>
          <RunLineVerb className='text-status-attention-ink'>
            Needs you
          </RunLineVerb>
          {prompt && <RunLineNote>{prompt}</RunLineNote>}
        </RunLine>
      </RunTab>
    );
  }

  return (
    <RunTab aria-label='Show what Lab is doing' onClick={onJump}>
      <RunLine mark={mark} stall={stall}>
        <Verb
          label={label}
          live={pose === 'pondering' || pose === 'working'}
          tick={tick}
        />
        {timed && <RunLineTime>{duration(elapsed)}</RunLineTime>}
      </RunLine>
    </RunTab>
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

function callsOf(steps: readonly Step[]) {
  return steps.flatMap((step) => (step.kind === 'tool' ? [step.call] : []));
}

const cheers = {
  done: 'run.done',
  idle: undefined,
  proud: 'run.proud',
} as const;

export function cheerOf(
  steps: readonly Step[],
  span: Span | undefined,
  results: Results
) {
  const calls = callsOf(steps);

  return cheers[cheerFor(worked(span, calls, results) ?? 0, calls.length)];
}

export function asks(
  steps: readonly Step[],
  progress: Progress,
  results: Results
) {
  const current = callsOf(steps).findLast(({ id }) => !results.has(id));

  const approval = approvalOf(current && progress.get(current.id)?.details);

  return (
    current !== undefined &&
    (current.name === 'ask_user' ||
      (approval !== undefined && approval.decision === undefined))
  );
}

type Hop = 'done' | 'proud' | undefined;

export const RunHead = createContext<
  ((element: HTMLElement | null) => void) | undefined
>(undefined);

type RunProps = {
  activity: string | undefined;
  clock: Clock | undefined;
  progress: Progress;
  results: Results;
  retry: Retry | undefined;
  span: Span | undefined;
  steps: readonly Step[];
  working: boolean;
  writing: boolean;
};

export function Run({
  activity,
  clock,
  failed,
  hop,
  latest,
  progress,
  results,
  retry,
  span,
  steps,
  working,
  writing,
}: RunProps & { failed: boolean; hop: Hop; latest: boolean }) {
  const living = useMoment('run.mark');

  const [open, setOpen] = useState(false);

  const calls = callsOf(steps);

  const total = worked(span, calls, results);

  const [only] = calls;

  const single =
    !working && calls.length === 1 && (total ?? 0) < presence.bands.summary;

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
            living.on &&
            latest &&
            !failed && <LiveMark className='size-3.5' state={hop ?? 'idle'} />
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
                span={step.span}
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

export function Dock({
  hop,
  onJump,
  shown,
  span,
  steps,
  working,
  ...run
}: RunProps & { hop: Hop; onJump: () => void; shown: boolean }) {
  const calls = callsOf(steps);

  const total = worked(span, calls, run.results);

  return (
    <AnimatePresence>
      {shown && (
        <m.div
          key='dock'
          animate={{ opacity: 1, y: 0 }}
          className='absolute bottom-full left-12 flex max-w-2/5 translate-y-px'
          exit={{ opacity: 0, transition: fade.leave, y: 8 }}
          initial={{ opacity: 0, y: 8 }}
          transition={{ ...fade.base, y: spring.snap }}
        >
          {working ? (
            <DockLive {...run} calls={calls} onJump={onJump} />
          ) : (
            <RunTab aria-label='Show the finished run' onClick={onJump}>
              <RunLine mark={<LiveMark className='size-3.5' state={hop} />}>
                <RunLineVerb>
                  {total === undefined
                    ? 'Worked'
                    : `Worked for ${duration(total)}`}
                </RunLineVerb>
              </RunLine>
            </RunTab>
          )}
        </m.div>
      )}
    </AnimatePresence>
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
