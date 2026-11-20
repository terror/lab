import '@/index.css';
import { afterEach, expect, test } from 'vitest';

import { confetti } from './confetti';

afterEach(() => {
  for (const canvas of document.querySelectorAll('canvas')) {
    canvas.remove();
  }
});

test('the raw spark tokens are the hex colors canvas-confetti can read', () => {
  const style = getComputedStyle(document.documentElement);

  expect(
    ['coral', 'blue', 'yellow'].map((hue) =>
      style.getPropertyValue(`--spark-${hue}`)
    )
  ).toEqual(['#f09082', '#4d9abf', '#f1be58']);
});

test('confetti draws on a canvas', async () => {
  void confetti(document.body);

  await expect
    .poll(() => document.querySelectorAll('canvas').length, { timeout: 5000 })
    .toBe(1);
});
