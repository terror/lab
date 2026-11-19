import '@/index.css';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

import { HomeFrame } from './home-frame';

test('the anchor stays at 38% of the frame however much sits above and below it', async () => {
  const tops = [];

  for (const lines of [1, 3]) {
    const screen = await render(
      <div className='flex h-125 flex-col'>
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

  expect(tops).toEqual([190, 190]);
});
