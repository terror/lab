import '@/index.css';
import { domAnimation } from 'motion/react';
import { expect, test } from 'vitest';
import { renderHook } from 'vitest-browser-react';
import { cdp } from 'vitest/browser';

import { fade, stagger, useMaxFeatures } from './motion';
import max from './motion-max';

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

function entrance() {
  const probe = document.createElement('div');

  probe.className = 'animate-in zoom-in-95 slide-in-from-bottom-2';
  document.body.append(probe);

  const style = getComputedStyle(probe);

  const read = {
    scale: style.getPropertyValue('--tw-enter-scale'),
    y: style.getPropertyValue('--tw-enter-translate-y'),
  };

  probe.remove();

  return read;
}

test('reduced motion takes the travel and zoom out of an entrance', async ({
  onTestFinished,
}) => {
  const moving = entrance();

  await cdp().send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });

  onTestFinished(async () => {
    await cdp().send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: '' }],
    });
  });

  expect({ moving, reduced: entrance() }).toEqual({
    moving: { scale: '.95', y: 'calc(2*0.25rem)' },
    reduced: { scale: '1', y: '0' },
  });
});

test('layout features start from the shared renderer and arrive once loaded', async () => {
  const { result } = await renderHook(() => useMaxFeatures());

  const first = result.current;

  await expect.poll(() => result.current.settled).toBe(true);

  const { result: later } = await renderHook(() => useMaxFeatures());

  expect({ first, last: result.current, later: later.current }).toEqual({
    first: { features: domAnimation, settled: false },
    last: { features: max, settled: true },
    later: { features: max, settled: true },
  });
});
