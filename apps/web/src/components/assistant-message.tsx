import { Markdown } from '@/components/markdown';
import { MessageActions, type Retry } from '@/components/message-actions';
import { Plan } from '@/components/plan';
import { type Retry as Backoff, Run, RunHead } from '@/components/run';
import { ToolCards } from '@/components/tool-steps';
import type { ToolProgress, ToolResult } from '@/components/tools';
import { LiveMark } from '@/components/ui/live-mark';
import { Message, MessageContent } from '@/components/ui/message';
import { StatusIcon } from '@/components/ui/status-icon';
import { TraceIcon } from '@/components/ui/trace';
import type { ModelChoice } from '@/lib/models';
import { useMoment } from '@/lib/moment';
import { fade, spring } from '@/lib/motion';
import type { Clock } from '@/lib/presence';
import { runEnding } from '@/lib/run-failure';
import { steps, worked } from '@/lib/spans';
import type { Part, Round, Span } from '@/lib/transcript';
import { cn } from '@/lib/utils';
import type { RunFailureReason } from '@earendil-works/pi-durable';
import type { PlanStep } from '@lab/server/schemas';
import { m } from 'motion/react';
import { type ReactNode, useContext, useState } from 'react';

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

export function RunFailure({
  at,
  mark = 'broken',
  finished = 0,
  reason,
  wrote = false,
}: {
  at?: number;
  finished?: number;
  mark?: 'broken' | 'error' | 'recover';
  reason: RunFailureReason;
  wrote?: boolean;
}) {
  const slipped = useMoment('run.failure');

  const stopped = reason === 'aborted';

  const { kept, title } = runEnding(reason, { at, steps: finished, wrote });

  return (
    <div
      className='flex min-w-0 items-start gap-2 text-sm text-muted-foreground'
      role='alert'
    >
      <TraceIcon className={cn('h-5', !stopped && 'text-destructive')}>
        {stopped || !slipped.on ? (
          <StatusIcon status={stopped ? 'stopped' : 'failed'} />
        ) : (
          <LiveMark className='size-3.5' state={mark} />
        )}
      </TraceIcon>
      <p className='min-w-0 wrap-break-word'>
        <span className={cn(!stopped && 'text-destructive')}>{title}</span>
        {kept && ` · ${kept}`}
      </p>
    </div>
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

const noRounds: readonly Round[] = [];

function Arrival({
  anchor,
  children,
  late,
}: {
  anchor: boolean;
  children: ReactNode;
  late: boolean;
}) {
  const register = useContext(RunHead);
  const [glide] = useState(late);
  const [settled, setSettled] = useState(!late);

  return (
    <m.div
      animate={{ height: 'auto', opacity: 1 }}
      className={cn('-mb-3', !settled && 'overflow-hidden')}
      initial={glide ? { height: 0, opacity: 0 } : false}
      onAnimationComplete={() => setSettled(true)}
      transition={{ ...fade.base, height: spring.glide }}
    >
      <div className='pb-3' ref={anchor ? register : undefined}>
        {children}
      </div>
    </m.div>
  );
}

export function AssistantMessage({
  activity,
  backoff,
  clock,
  failure,
  hop,
  latest = false,
  model,
  onRetry,
  parts,
  plan,
  progress,
  results,
  retrying = false,
  rounds = noRounds,
  slip = false,
  span,
  streaming,
  versions,
  working = false,
}: {
  activity?: string;
  backoff?: Backoff;
  clock?: Clock;
  failure?: RunFailureReason;
  hop?: 'done' | 'proud';
  latest?: boolean;
  model?: ModelChoice;
  onRetry?: Retry;
  parts: readonly Part[];
  plan?: ShownPlan;
  progress: ReadonlyMap<string, ToolProgress>;
  results: ReadonlyMap<string, ToolResult>;
  retrying?: boolean;
  rounds?: readonly Round[];
  slip?: boolean;
  span?: Span;
  streaming: boolean;
  versions?: ReactNode;
  working?: boolean;
}) {
  const [mended, setMended] = useState(false);

  if (retrying && !mended) {
    setMended(true);
  }

  const text = replyText(parts);

  const answer = !streaming && (text.length > 0 || failure !== undefined);

  const all = segments(parts);

  const split = all.findLastIndex(({ kind }) => kind === 'tools') + 1;

  const ledger = steps(parts, rounds, results);

  const calls = ledger.flatMap((step) =>
    step.kind === 'tool' ? [step.call] : []
  );

  const wrote = all.some(({ kind }) => kind === 'text');

  const shown = split > 0 || (working && !wrote);

  const [hidden, setHidden] = useState(!shown);

  if (!shown && !hidden) {
    setHidden(true);
  }

  const shared = { parts, progress, results, streaming, working };

  const broken = slip && !mended ? 'error' : 'broken';

  return (
    <Message>
      <MessageContent className='gap-3 text-base'>
        {shown && (
          <Arrival anchor={latest || working} late={hidden}>
            <Run
              activity={activity}
              clock={clock}
              failed={failure !== undefined}
              hop={hop}
              latest={latest}
              progress={progress}
              results={results}
              retry={backoff}
              span={span}
              steps={ledger}
              working={working}
              writing={streaming && parts.at(-1)?.type === 'text'}
            />
          </Arrival>
        )}
        <Segments segments={all.slice(0, split)} {...shared} />
        {plan && <Plan {...plan} />}
        <Segments segments={all.slice(split)} {...shared} />
        {failure && (
          <RunFailure
            at={worked(span, calls, results)}
            finished={
              calls.filter(({ id }) => results.get(id)?.status === 'done')
                .length
            }
            mark={retrying ? 'recover' : broken}
            reason={failure}
            wrote={text.length > 0}
          />
        )}
        {answer && (
          <MessageActions
            latest={latest}
            model={model}
            onRetry={onRetry}
            spin={failure === undefined || failure === 'aborted'}
            text={text}
            versions={versions}
          />
        )}
      </MessageContent>
    </Message>
  );
}
