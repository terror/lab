import css from '@/index.css?raw';
import { expect, test } from 'vitest';

import { cn } from './utils';

const utilities: Record<string, string> = {
  radius: 'rounded',
  'transition-duration': 'duration',
};

const resets: Record<string, string> = {
  radius: 'rounded-none',
  'transition-duration': 'duration-0',
};

test('a later class replaces every radius and duration token', () => {
  const tokens = [
    ...css.matchAll(/--(radius|transition-duration)-([a-z0-9]+):/g),
  ].map(([, scale = '', name = '']) => ({ name, scale }));

  const kept = tokens
    .map(({ name, scale }) => cn(`${utilities[scale]}-${name}`, resets[scale]))
    .filter((merged) => merged.includes(' '));

  expect({
    kept,
    scales: [...new Set(tokens.map(({ scale }) => scale))],
  }).toEqual({ kept: [], scales: ['radius', 'transition-duration'] });
});
