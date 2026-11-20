import { approvalOf } from '@/components/approval-card';
import type { ToolResult } from '@/components/tools';

import type { Part, Round, Row, Span } from './transcript';

type Call = Extract<Part, { type: 'toolCall' }>;

type Results = ReadonlyMap<string, ToolResult>;

export type Step =
  | { call: Call; kind: 'tool'; span?: Span }
  | { key: string; kind: 'thought' | 'waited'; span: Span };

export const NOTABLE_MS = 3_000;

const LONG_CALL = 2_000;

function isCall(part: Part): part is Call {
  return part.type === 'toolCall';
}

function authored(call: Call) {
  return JSON.stringify(call.arguments).length >= LONG_CALL;
}

function pauseFor(
  parts: readonly Part[],
  calls: readonly Call[],
  span: Span
): 'thought' | 'waited' | undefined {
  const long = span.end - span.start >= NOTABLE_MS;

  if (calls.length === 0 || calls.some(authored) || !long) {
    return undefined;
  }

  return parts.some((part) => part.type === 'thinking') ? 'thought' : 'waited';
}

function roundSteps(
  parts: readonly Part[],
  { span }: Round,
  from: number | undefined,
  results: Results
) {
  const calls = parts.filter(isCall);

  const pause = pauseFor(parts, calls, span);

  const credited = pause ? undefined : (calls.find(authored) ?? calls[0]);

  const gap = from !== undefined && span.start - from >= NOTABLE_MS;

  const found: Step[] = [
    ...(gap
      ? [
          {
            key: `gap-${span.start}`,
            kind: 'waited' as const,
            span: { end: span.start, start: from },
          },
        ]
      : []),
    ...(pause ? [{ key: `round-${span.start}`, kind: pause, span }] : []),
    ...calls.map((call) => {
      const ran = results.get(call.id)?.span;

      return {
        call,
        kind: 'tool' as const,
        span:
          ran && call === credited ? { end: ran.end, start: span.start } : ran,
      };
    }),
  ];

  const until = Math.max(
    span.end,
    ...calls.map(({ id }) => results.get(id)?.span?.end ?? 0)
  );

  return { steps: found, until };
}

export function steps(
  parts: readonly Part[],
  rounds: readonly Round[],
  results: Results
) {
  const timed = rounds.reduce<{ from?: number; steps: Step[] }>(
    (walked, round) => {
      const { steps: found, until } = roundSteps(
        parts.slice(round.at, round.at + round.parts),
        round,
        walked.from,
        results
      );

      return { from: until, steps: [...walked.steps, ...found] };
    },
    { steps: [] }
  );

  const covered = Math.max(
    0,
    ...rounds.map(({ at, parts: size }) => at + size)
  );

  const untimed = parts
    .slice(covered)
    .filter(isCall)
    .map((call): Step => ({ call, kind: 'tool' }));

  return [...timed.steps, ...untimed];
}

function overlap(span: Span, waits: readonly Span[]) {
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

function asks(calls: readonly Call[], results: Results) {
  return calls.flatMap((call) => {
    const result = results.get(call.id);

    const asked =
      call.name === 'ask_user' || approvalOf(result?.details) !== undefined;

    return asked && result?.span ? [result.span] : [];
  });
}

export function worked(
  span: Span | undefined,
  calls: readonly Call[],
  results: Results
) {
  return span && span.end - span.start - overlap(span, asks(calls, results));
}

function recorded(
  rows: readonly Row[],
  first: number | undefined,
  requested: number | undefined
) {
  const sender = rows.find(
    (row) => row.kind === 'user' && row.entryId === first
  );

  if (sender?.kind === 'user' && sender.sent !== undefined) {
    return sender.sent;
  }

  const reply = rows
    .slice(rows.findLastIndex(({ kind }) => kind === 'user') + 1)
    .find(({ kind }) => kind === 'assistant');

  const began = reply?.kind === 'assistant' ? reply.rounds?.[0] : undefined;

  return began?.span.start ?? requested;
}

export function runTiming(
  rows: readonly Row[],
  results: Results,
  {
    first,
    requested,
    seen,
  }: {
    first: number | undefined;
    requested: number | undefined;
    seen: { at: number; fresh: boolean };
  }
) {
  const start = seen.fresh
    ? seen.at
    : (recorded(rows, first, requested) ?? seen.at);

  const calls = rows.flatMap((row) =>
    row.kind === 'assistant' ? row.parts.filter(isCall) : []
  );

  return {
    start,
    waited: overlap(
      { end: Number.POSITIVE_INFINITY, start },
      asks(calls, results)
    ),
  };
}
