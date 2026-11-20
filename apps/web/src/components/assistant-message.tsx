import { Markdown } from '@/components/markdown';
import { MessageActions, type Retry } from '@/components/message-actions';
import { Plan } from '@/components/plan';
import { type Retry as Backoff, Run } from '@/components/run';
import { ToolCards } from '@/components/tool-steps';
import type { ToolProgress, ToolResult } from '@/components/tools';
import { LiveMark } from '@/components/ui/live-mark';
import { Message, MessageContent } from '@/components/ui/message';
import { StatusIcon } from '@/components/ui/status-icon';
import { TraceIcon, TraceLine, TraceTitle } from '@/components/ui/trace';
import type { ModelChoice } from '@/lib/models';
import { fade, spring } from '@/lib/motion';
import type { Clock } from '@/lib/presence';
import { runFailureTitles } from '@/lib/run-failure';
import { steps } from '@/lib/spans';
import type { Part, Round, Span } from '@/lib/transcript';
import { cn } from '@/lib/utils';
import { useQuiet } from '@/lib/voice';
import type { RunFailureReason } from '@earendil-works/pi-durable';
import type { PlanStep } from '@lab/server/schemas';
import { m } from 'motion/react';
import { type ReactNode, useState } from 'react';

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
  mark = 'broken',
  reason,
}: {
  mark?: 'broken' | 'error' | 'recover';
  reason: RunFailureReason;
}) {
  const quiet = useQuiet();

  const stopped = reason === 'aborted';

  return (
    <TraceLine role='alert' status={stopped ? undefined : 'error'}>
      <TraceIcon>
        {stopped || quiet ? (
          <StatusIcon status={stopped ? 'stopped' : 'failed'} />
        ) : (
          <LiveMark className='size-3.5' state={mark} />
        )}
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

const noRounds: readonly Round[] = [];

function Arrival({ children, late }: { children: ReactNode; late: boolean }) {
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
      <div className='pb-3'>{children}</div>
    </m.div>
  );
}

export function AssistantMessage({
  activity,
  backoff,
  clock,
  failure,
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
          <Arrival late={hidden}>
            <Run
              activity={activity}
              clock={clock}
              failed={failure !== undefined}
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
          <RunFailure mark={retrying ? 'recover' : broken} reason={failure} />
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
