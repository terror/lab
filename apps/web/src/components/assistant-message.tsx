import { Markdown } from '@/components/markdown';
import { MessageActions, type Retry } from '@/components/message-actions';
import { Plan } from '@/components/plan';
import {
  Activity,
  LiveSteps,
  StepStatus,
  timeWorked,
  ToolCards,
  Worked,
} from '@/components/tool-steps';
import type { ToolProgress, ToolResult } from '@/components/tools';
import { LiveMark } from '@/components/ui/live-mark';
import { Message, MessageContent } from '@/components/ui/message';
import { StatusIcon } from '@/components/ui/status-icon';
import { TraceIcon, TraceLine, TraceTitle } from '@/components/ui/trace';
import { cheerFor, useCheer } from '@/lib/cheer';
import type { ModelChoice } from '@/lib/models';
import { fade, spring } from '@/lib/motion';
import { runFailureTitles } from '@/lib/run-failure';
import type { Part, Span } from '@/lib/transcript';
import { cn } from '@/lib/utils';
import { useQuiet } from '@/lib/voice';
import type { RunFailureReason } from '@earendil-works/pi-durable';
import type { PlanStep } from '@lab/server/schemas';
import { AnimatePresence, m } from 'motion/react';
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
  retrying = false,
  slip = false,
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
  retrying?: boolean;
  slip?: boolean;
  span?: Span;
  streaming: boolean;
  versions?: ReactNode;
  working?: boolean;
}) {
  const cheer = useCheer(working);
  const quiet = useQuiet();
  const [mended, setMended] = useState(false);

  if (retrying && !mended) {
    setMended(true);
  }

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

  const worked = timeWorked(span, calls, results);

  const marks = {
    cheer: cheerFor(worked ?? 0, calls.length),
    held: 'idle',
    rest: 'idle',
    working: 'thinking',
  } as const;

  const marked = !quiet && (working || (latest && failure === undefined));

  const broken = slip && !mended ? 'error' : 'broken';

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
            calls={calls}
            mark={marked ? marks[cheer] : undefined}
            progress={progress}
            results={results}
            worked={worked}
            working={working}
          />
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
