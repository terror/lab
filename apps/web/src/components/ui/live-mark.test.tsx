import '@/index.css';
import { spring } from '@/lib/motion';
import * as motion from 'motion/react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { cdp } from 'vitest/browser';

import { Dot } from './dot';
import { LiveMark } from './live-mark';

function animations(root: Element) {
  const names = [root, ...root.querySelectorAll('*')].flatMap((element) =>
    getComputedStyle(element).animationName.split(', ')
  );

  return [...new Set(names)].filter((name) => name !== 'none').toSorted();
}

test('each state of the mark runs its own animation and idle runs none', async () => {
  const seen = new Map<string, string[]>();

  for (const state of [
    'idle',
    'assemble',
    'thinking',
    'done',
    'error',
  ] as const) {
    const screen = await render(<LiveMark data-testid='foo' state={state} />);

    seen.set(state, animations(screen.getByTestId('foo').element()));

    await screen.unmount();
  }

  expect(Object.fromEntries(seen)).toEqual({
    assemble: ['live-mark-assemble', 'live-mark-fade'],
    done: ['live-mark-hop', 'live-mark-sparkle'],
    error: ['live-mark-slip', 'live-mark-slip-coral'],
    idle: [],
    thinking: [
      'live-mark-bubble',
      'live-mark-slosh-blue',
      'live-mark-slosh-yellow',
    ],
  });
});

test('a live dot pulses and an attention dot stays still', async () => {
  const screen = await render(
    <>
      <Dot data-testid='foo' tone='live' />
      <Dot data-testid='bar' tone='attention' />
    </>
  );

  expect({
    attention: animations(screen.getByTestId('bar').element()),
    live: animations(screen.getByTestId('foo').element()),
  }).toEqual({ attention: [], live: ['dot-pulse'] });
});

test('under reduced motion the mark only fades and dims, and the dot holds still', async ({
  onTestFinished,
}) => {
  await cdp().send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });

  onTestFinished(async () => {
    await cdp().send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: '' }],
    });
  });

  const seen = new Map<string, string[]>();

  for (const state of ['assemble', 'thinking', 'done', 'error'] as const) {
    const screen = await render(<LiveMark data-testid='foo' state={state} />);

    seen.set(state, animations(screen.getByTestId('foo').element()));

    await screen.unmount();
  }

  const screen = await render(
    <>
      <Dot data-testid='bar' tone='live' />
      <LiveMark data-testid='baz' state='error' />
    </>
  );

  seen.set('dot', animations(screen.getByTestId('bar').element()));

  const mark = screen.getByTestId('baz').element();

  const pose = ['coral', 'blue', 'yellow'].map(
    (part) =>
      getComputedStyle(mark.querySelector(`[data-part='${part}']`) ?? mark)
        .transform
  );

  expect({ animations: Object.fromEntries(seen), pose }).toEqual({
    animations: {
      assemble: ['live-mark-fade'],
      done: [],
      dot: [],
      error: [],
      thinking: ['live-mark-dim'],
    },
    pose: [
      'matrix(0.990268, -0.139173, 0.139173, 0.990268, -2, 1)',
      'matrix(1, 0, 0, 1, -1, 1)',
      'matrix(1, 0, 0, 1, 4, 2)',
    ],
  });
});

test('the pop curve of the mark follows the pop spring preset', async () => {
  const screen = await render(<LiveMark data-testid='foo' />);

  const style = getComputedStyle(screen.getByTestId('foo').element());

  const duration = Number.parseFloat(style.getPropertyValue('--pop-duration'));

  const generator = motion.spring({ ...spring.pop, keyframes: [0, 1] });

  const stops = style.getPropertyValue('--pop').match(/[\d.]+ [\d.]+%/g) ?? [];

  const drift = stops.map((stop) => {
    const [value = 0, at = 0] = stop.split(' ').map(Number.parseFloat);

    return Math.abs(generator.next((at / 100) * duration).value - value);
  });

  expect({ drift: Math.max(...drift) < 0.01, stops: stops.length }).toEqual({
    drift: true,
    stops: 60,
  });
});
