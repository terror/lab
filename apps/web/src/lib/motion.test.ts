import '@/index.css';
import { expect, test } from 'vitest';

import { fade, stagger } from './motion';

test('tween durations and stagger match the stylesheet tokens', () => {
  const probe = document.createElement('div');

  document.body.append(probe);

  const seconds = (token: string) => {
    probe.style.transitionDuration = `var(--motion-${token})`;

    return Number.parseFloat(getComputedStyle(probe).transitionDuration);
  };

  expect({
    base: seconds('base'),
    fast: seconds('fast'),
    stagger: seconds('stagger'),
  }).toEqual({
    base: fade.base.duration,
    fast: fade.fast.duration,
    stagger,
  });

  probe.remove();
});
