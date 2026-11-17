import { act } from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { renderHook } from 'vitest-browser-react';

import { useSteady } from './steady';

afterEach(() => {
  vi.useRealTimers();
});

test('a value stays shown for the hold time and then jumps to the latest', async () => {
  vi.useFakeTimers();

  const { rerender, result } = await renderHook(
    (props?: { value: string }) => useSteady(props?.value, 800),
    { initialProps: { value: 'foo' } }
  );

  const shown = new Array<string | undefined>();

  for (const [value, wait] of [
    ['bar', 100],
    ['baz', 100],
    ['qux', 700],
    ['quux', 900],
  ] as const) {
    await rerender({ value });

    await act(() => vi.advanceTimersByTimeAsync(wait));

    shown.push(result.current);
  }

  expect(shown).toEqual(['foo', 'foo', 'qux', 'quux']);
});
