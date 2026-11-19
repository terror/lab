import '@/index.css';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { cdp } from 'vitest/browser';

import { Brief, BriefToken } from './brief';

test('a count in the brief is a button named by its number and words, with a 44px hit area on a touch screen', async ({
  onTestFinished,
}) => {
  await cdp().send('Emulation.setTouchEmulationEnabled', { enabled: true });

  onTestFinished(async () => {
    await cdp().send('Emulation.setTouchEmulationEnabled', { enabled: false });
  });

  const screen = await render(
    <Brief>
      foo <BriefToken count={2}>bar</BriefToken>
    </Brief>
  );

  const token = screen.getByRole('button', { name: '2 bar' });

  await expect.element(token).toBeVisible();

  expect(
    Math.round(
      Number.parseFloat(getComputedStyle(token.element(), '::after').height)
    )
  ).toBe(44);
});
