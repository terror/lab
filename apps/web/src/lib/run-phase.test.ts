import type { LiveState } from '@earendil-works/pi-durable';
import { expect, test } from 'vitest';

import { runPhase } from './run-phase';

test('a run is in one phase at a time', () => {
  const run = { run: {} } as unknown as LiveState;

  expect([
    runPhase(undefined, false),
    runPhase(run, false),
    runPhase(run, true),
    runPhase({ ...run, tools: [{ status: 'running' }] } as LiveState, false),
    runPhase({ ...run, run: { afterRun: {} } } as unknown as LiveState, false),
    runPhase(
      { ...run, generation: { retry: { at: 0, error: 'foo' } } } as LiveState,
      true
    ),
  ]).toEqual([
    { kind: 'idle' },
    { kind: 'thinking' },
    { kind: 'answering' },
    { kind: 'tools' },
    { kind: 'finishing' },
    { kind: 'retrying', retry: { at: 0, error: 'foo' } },
  ]);
});
