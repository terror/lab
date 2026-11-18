import { expect, test } from 'vitest';
import { renderHook } from 'vitest-browser-react';

import { holdGlide, useArrivals } from './glide';

async function arrivals(glided: boolean) {
  const release = glided ? holdGlide(0) : () => undefined;

  const hook = await renderHook(
    (props?: { keys: string[]; ready: boolean }) =>
      useArrivals(props?.keys ?? [], props?.ready ?? false),
    { initialProps: { keys: new Array<string>(), ready: false } }
  );

  release();

  return hook;
}

test('rows that load with the chat stay put and rows that come later arrive', async () => {
  const { rerender, result } = await arrivals(false);

  await rerender({ keys: ['foo'], ready: true });
  await rerender({ keys: ['foo', 'bar'], ready: true });

  expect(['foo', 'bar'].map(result.current)).toEqual([false, true]);
});

test('after a glide from home every row arrives', async () => {
  const { rerender, result } = await arrivals(true);

  await rerender({ keys: ['foo'], ready: true });

  expect(result.current('foo')).toBe(true);
});
