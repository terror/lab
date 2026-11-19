import '@/index.css';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

import { Pips } from './pips';

test('pips mark the finished steps and the step in progress, for plans of up to eight steps', async () => {
  await render(
    <>
      <Pips done={2} total={4} />
      <Pips done={3} total={9} />
    </>
  );

  expect(
    [...document.querySelectorAll('[data-slot=pips]')].map((pips) =>
      [...pips.children].map((pip) => pip.getAttribute('data-state'))
    )
  ).toEqual([['done', 'done', 'current', 'ahead']]);
});
