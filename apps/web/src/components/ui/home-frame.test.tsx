import '@/index.css';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { cdp } from 'vitest/browser';

import { HomeFrame } from './home-frame';

test('the anchor stays at 38% of the frame while what sits above fits, holds at 14rem in a short frame, leaves room for the box in a very short one, and gives way before anything above is cut off', async () => {
  const tops = [];

  for (const [height, lines] of [
    ['h-200', 1],
    ['h-200', 5],
    ['h-125', 5],
    ['h-75', 1],
    ['h-125', 9],
  ] as const) {
    const screen = await render(
      <div className={height}>
        <HomeFrame
          above={Array.from({ length: lines }, (_, index) => (
            <p key={index}>foo</p>
          ))}
          below={<div className='h-225' />}
        >
          bar
        </HomeFrame>
      </div>
    );

    const frame = screen.container.querySelector('[data-slot=home-frame]');
    const anchor = screen.container.querySelector('[data-slot=home-anchor]');

    tops.push(
      Math.round(
        (anchor?.getBoundingClientRect().top ?? 0) -
          (frame?.getBoundingClientRect().top ?? 0)
      )
    );

    await screen.unmount();
  }

  expect(tops).toEqual([304, 304, 224, 172, 372]);
});

test('on a phone the box docks at the bottom of the frame, after what sits above and below it', async ({
  onTestFinished,
}) => {
  await cdp().send('Emulation.setTouchEmulationEnabled', { enabled: true });

  onTestFinished(async () => {
    await cdp().send('Emulation.setTouchEmulationEnabled', { enabled: false });
  });

  const screen = await render(
    <div className='h-125'>
      <HomeFrame above={<p>foo</p>} below={<p>baz</p>}>
        bar
      </HomeFrame>
    </div>
  );

  const frame = screen.container
    .querySelector('[data-slot=home-frame]')
    ?.getBoundingClientRect();

  const anchor = screen.container
    .querySelector('[data-slot=home-anchor]')
    ?.getBoundingClientRect();

  const below = screen.getByText('baz').element().getBoundingClientRect();

  expect([
    Math.round((frame?.bottom ?? 0) - (anchor?.bottom ?? 0)),
    (anchor?.top ?? 0) >= below.bottom,
  ]).toEqual([0, true]);
});
