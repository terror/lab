import '@/index.css';
import { afterEach, expect, test, vi } from 'vitest';

import { confetti } from './confetti';

afterEach(() => {
  for (const canvas of document.querySelectorAll('canvas')) {
    canvas.remove();
  }
});

function outcome(reduced: boolean) {
  vi.spyOn(window, 'matchMedia').mockReturnValue({
    matches: reduced,
  } as MediaQueryList);

  return Promise.race([
    confetti(document.body).then(() => 'settled'),
    new Promise<string>((resolve) => {
      setTimeout(() => resolve('running'), 50);
    }),
  ]);
}

test('the raw spark tokens are the hex colors canvas-confetti can read', () => {
  const style = getComputedStyle(document.documentElement);

  expect(
    ['coral', 'blue', 'yellow'].map((hue) =>
      style.getPropertyValue(`--spark-${hue}`)
    )
  ).toEqual(['#f09082', '#4d9abf', '#f1be58']);
});

test('confetti stays off under reduced motion and draws on a canvas otherwise', async () => {
  expect({
    reduced: await outcome(true),
    moving: await outcome(false),
  }).toEqual({ moving: 'running', reduced: 'settled' });

  await expect
    .poll(() => document.querySelectorAll('canvas').length, { timeout: 5000 })
    .toBe(1);
});
