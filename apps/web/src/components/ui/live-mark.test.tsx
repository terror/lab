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
    'pondering',
    'done',
    'proud',
    'handoff',
    'waiting',
    'ahem',
    'gulp',
    'drift',
    'error',
    'broken',
    'recover',
    'doze',
    'wake',
    'held',
    'bubble',
    'fizz',
  ] as const) {
    const screen = await render(<LiveMark data-testid='foo' state={state} />);

    seen.set(state, animations(screen.getByTestId('foo').element()));

    await screen.unmount();
  }

  expect(Object.fromEntries(seen)).toEqual({
    ahem: ['live-mark-ahem', 'live-mark-ping-ahem'],
    assemble: ['live-mark-assemble', 'live-mark-fade'],
    broken: [],
    bubble: [
      'live-mark-bubble',
      'live-mark-slosh-blue',
      'live-mark-slosh-yellow',
    ],
    done: ['live-mark-hop', 'live-mark-sparkle'],
    doze: ['live-mark-doze', 'live-mark-doze-lid', 'live-mark-z'],
    drift: ['live-mark-ping-away'],
    error: ['live-mark-slip', 'live-mark-slip-coral'],
    fizz: [
      'live-mark-bubble',
      'live-mark-gulp',
      'live-mark-lid-jump',
      'live-mark-slosh-blue',
      'live-mark-slosh-yellow',
    ],
    gulp: ['live-mark-gulp', 'live-mark-ping-drop'],
    handoff: [
      'live-mark-dot',
      'live-mark-drop',
      'live-mark-hop',
      'live-mark-sparkle',
    ],
    held: ['live-mark-slosh-blue', 'live-mark-slosh-yellow'],
    idle: [],
    pondering: [
      'live-mark-ponder',
      'live-mark-slosh-blue',
      'live-mark-slosh-yellow',
    ],
    proud: ['live-mark-hop-big', 'live-mark-lid', 'live-mark-sparkle'],
    recover: ['live-mark-assemble', 'live-mark-mend'],
    thinking: [
      'live-mark-bubble',
      'live-mark-slosh-blue',
      'live-mark-slosh-yellow',
    ],
    waiting: ['live-mark-ping-bob', 'live-mark-ping-in'],
    wake: ['live-mark-wake'],
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

  for (const state of [
    'assemble',
    'thinking',
    'done',
    'proud',
    'handoff',
    'waiting',
    'ahem',
    'gulp',
    'drift',
    'error',
    'broken',
    'recover',
    'doze',
    'wake',
    'held',
    'bubble',
    'fizz',
    'pondering',
  ] as const) {
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
      ahem: [],
      assemble: ['live-mark-fade'],
      broken: [],
      bubble: [],
      done: [],
      dot: [],
      doze: [],
      drift: [],
      error: [],
      fizz: [],
      gulp: [],
      handoff: ['live-mark-hide', 'live-mark-show'],
      held: [],
      pondering: [],
      proud: [],
      recover: [],
      thinking: ['live-mark-dim'],
      waiting: [],
      wake: [],
    },
    pose: [
      'matrix(0.990268, -0.139173, 0.139173, 0.990268, -2, 1)',
      'matrix(1, 0, 0, 1, -1, 1)',
      'matrix(1, 0, 0, 1, 4, 2)',
    ],
  });
});

test('a broken mark holds the slipped pose without playing the slip', async () => {
  const screen = await render(<LiveMark data-testid='foo' state='broken' />);

  const mark = screen.getByTestId('foo').element();

  expect(
    ['coral', 'blue', 'yellow'].map(
      (part) =>
        getComputedStyle(mark.querySelector(`[data-part='${part}']`) ?? mark)
          .transform
    )
  ).toEqual([
    'matrix(0.990268, -0.139173, 0.139173, 0.990268, -2, 1)',
    'matrix(1, 0, 0, 1, -1, 1)',
    'matrix(1, 0, 0, 1, 4, 2)',
  ]);
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
