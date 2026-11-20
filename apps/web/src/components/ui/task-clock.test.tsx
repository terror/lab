import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

import { TaskClock } from './task-clock';

async function hand(props: Parameters<typeof TaskClock>[0]) {
  const screen = await render(<TaskClock {...props} />);

  const line = screen.container.querySelector('line');

  return line instanceof SVGElement ? line.style.transform : '';
}

test('the hand turns with the wait and each wind-up adds a turn', async () => {
  expect([
    await hand({}),
    await hand({ progress: 0.5 }),
    await hand({ progress: 2 }),
    await hand({ progress: 0.25, turns: 1 }),
  ]).toEqual([
    'rotate(0deg)',
    'rotate(180deg)',
    'rotate(360deg)',
    'rotate(450deg)',
  ]);
});
