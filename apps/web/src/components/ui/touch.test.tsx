import '@/index.css';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { cdp } from 'vitest/browser';

import { Button } from './button';
import { Checkbox } from './checkbox';
import { Switch } from './switch';

const sizes = ['default', 'sm', 'icon', 'icon-xs', 'icon-sm'] as const;

test('buttons, switches, and checkboxes get a 44px hit area on a touch screen', async ({
  onTestFinished,
}) => {
  await cdp().send('Emulation.setTouchEmulationEnabled', { enabled: true });

  onTestFinished(async () => {
    await cdp().send('Emulation.setTouchEmulationEnabled', { enabled: false });
  });

  await render(
    <>
      {sizes.map((size) => (
        <Button key={size} size={size}>
          foo
        </Button>
      ))}
      <Button className='size-5'>bar</Button>
      <Switch aria-label='baz' />
      <Switch aria-label='qux' size='sm' />
      <Checkbox aria-label='quux' />
    </>
  );

  const smallest = [
    ...document.querySelectorAll(
      '[data-slot=button], [data-slot=switch], [data-slot=checkbox]'
    ),
  ].map((control) => {
    const { height, width } = getComputedStyle(control, '::after');

    return Math.round(
      Math.min(Number.parseFloat(height), Number.parseFloat(width))
    );
  });

  expect(smallest).toEqual([44, 44, 44, 44, 44, 44, 44, 44, 44]);
});
