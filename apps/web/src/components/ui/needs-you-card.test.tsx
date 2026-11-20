import '@/index.css';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { cdp } from 'vitest/browser';

import { NeedsYouCard } from './needs-you-card';

test('a card keeps unbroken text inside it and gives its title link a 44px hit area that nothing clips', async ({
  onTestFinished,
}) => {
  await cdp().send('Emulation.setTouchEmulationEnabled', { enabled: true });

  onTestFinished(async () => {
    await cdp().send('Emulation.setTouchEmulationEnabled', { enabled: false });
  });

  const screen = await render(
    <NeedsYouCard
      className='w-80'
      link={(title) => <a href='#foo'>{title}</a>}
      title={'bar'.repeat(60)}
    >
      <p>{'baz'.repeat(60)}</p>
    </NeedsYouCard>
  );

  const card = screen.container.querySelector('[data-slot=card]');
  const link = screen.getByRole('link').element();

  const clipped = [];

  for (
    let parent = link.parentElement;
    parent && parent !== card;
    parent = parent.parentElement
  ) {
    clipped.push(getComputedStyle(parent).overflow);
  }

  expect([
    (card?.scrollWidth ?? 0) - (card?.clientWidth ?? 0),
    Math.round(Number.parseFloat(getComputedStyle(link, '::after').height)),
    clipped,
  ]).toEqual([0, 44, ['visible', 'visible']]);
});
