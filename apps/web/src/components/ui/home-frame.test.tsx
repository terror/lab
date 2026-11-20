import '@/index.css';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

import { HomeFrame } from './home-frame';

test('the anchor stays at 38% of the frame, and no higher than 17rem, however much sits around it', async () => {
  const tops = [];

  for (const [height, lines] of [
    ['h-200', 1],
    ['h-200', 9],
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

  expect(tops).toEqual([304, 304, 272]);
});
