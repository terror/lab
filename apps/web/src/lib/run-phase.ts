import type { LiveState } from '@earendil-works/pi-durable';

type Retry = NonNullable<NonNullable<LiveState['generation']>['retry']>;

export type RunPhase =
  | { kind: 'answering' }
  | { kind: 'finishing' }
  | { kind: 'idle' }
  | { kind: 'retrying'; retry: Retry }
  | { kind: 'thinking' }
  | { kind: 'tools' };

export function runPhase(
  live: LiveState | undefined,
  answering: boolean
): RunPhase {
  if (live?.run === undefined) {
    return { kind: 'idle' };
  }

  const retry = live.generation?.retry;

  if (retry) {
    return { kind: 'retrying', retry };
  }

  if (answering) {
    return { kind: 'answering' };
  }

  if ((live.tools ?? []).some(({ status }) => status !== 'done')) {
    return { kind: 'tools' };
  }

  if (live.run.afterRun !== undefined) {
    return { kind: 'finishing' };
  }

  return { kind: 'thinking' };
}
