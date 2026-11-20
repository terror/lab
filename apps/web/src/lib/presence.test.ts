import { act } from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { renderHook } from 'vitest-browser-react';

import { presenceFor, usePresence } from './presence';

const thinking = { quiet: 0, tool: false, waiting: false, writing: false };

afterEach(() => {
  vi.useRealTimers();
});

test('presence grows from the mark alone to a note that the run can be left', () => {
  expect(
    [0, 1_999, 2_000, 9_999, 10_000, 59_999, 60_000].map(
      (elapsed) => presenceFor(elapsed, thinking).band
    )
  ).toEqual(['mark', 'mark', 'verb', 'verb', 'summary', 'summary', 'leave']);
});

test('the pose says whether Lab waits, writes, works or ponders', () => {
  expect(
    [
      { ...thinking, tool: true, waiting: true, writing: true },
      { ...thinking, tool: true, writing: true },
      { ...thinking, tool: true },
      thinking,
    ].map((events) => presenceFor(0, events).pose)
  ).toEqual(['waiting', 'writing', 'working', 'pondering']);
});

function stalls(tool: boolean) {
  return [2_999, 3_000, 4_000, 5_000, 19_999, 20_000].map((quiet) => {
    const { slow, stall } = presenceFor(0, { ...thinking, quiet, tool });

    return [stall, slow];
  });
}

test('silence from the model eases into a stall, and a running tool never stalls', () => {
  expect({ thinking: stalls(false), working: stalls(true) }).toEqual({
    thinking: [
      [0, false],
      [0, false],
      [0.75, false],
      [1, false],
      [1, false],
      [1, true],
    ],
    working: [
      [0, false],
      [0, false],
      [0, false],
      [0, false],
      [0, false],
      [0, false],
    ],
  });
});

test('a run’s clock ticks its presence along and leaves out time spent waiting', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(100_000);

  const { result } = await renderHook(() =>
    usePresence({ at: 100_000, start: 94_000, waited: 6_000 }, thinking)
  );

  const seen = [result.current];

  for (const wait of [2_000, 2_000, 6_000, 10_000, 40_000]) {
    await act(() => vi.advanceTimersByTimeAsync(wait));

    seen.push(result.current);
  }

  expect(seen).toEqual([
    { band: 'mark', elapsed: 0, pose: 'pondering', slow: false, stall: 0 },
    { band: 'verb', elapsed: 2_000, pose: 'pondering', slow: false, stall: 0 },
    {
      band: 'verb',
      elapsed: 4_000,
      pose: 'pondering',
      slow: false,
      stall: 0.75,
    },
    {
      band: 'summary',
      elapsed: 10_000,
      pose: 'pondering',
      slow: false,
      stall: 1,
    },
    {
      band: 'summary',
      elapsed: 20_000,
      pose: 'pondering',
      slow: true,
      stall: 1,
    },
    { band: 'leave', elapsed: 60_000, pose: 'pondering', slow: true, stall: 1 },
  ]);
});
