import '@/index.css';
import { preferencesQueryOptions } from '@/lib/preferences';
import { renderWithQuery } from '@/test/helpers';
import { defaultPreferences } from '@lab/server/schemas';
import { QueryClient } from '@tanstack/react-query';
import { expect, test } from 'vitest';
import { cdp } from 'vitest/browser';

import { Brief, BriefToken } from './brief';

test('a count in the brief is a button named by its number and words, with a 44px hit area on a touch screen', async ({
  onTestFinished,
}) => {
  await cdp().send('Emulation.setTouchEmulationEnabled', { enabled: true });

  onTestFinished(async () => {
    await cdp().send('Emulation.setTouchEmulationEnabled', { enabled: false });
  });

  const client = new QueryClient();

  client.setQueryData(preferencesQueryOptions.queryKey, defaultPreferences);

  const { screen } = await renderWithQuery(
    <Brief>
      foo <BriefToken count={2}>bar</BriefToken>
    </Brief>,
    client
  );

  const token = screen.getByRole('button', { name: '2 bar' });

  await expect.element(token).toBeVisible();

  expect(
    Math.round(
      Number.parseFloat(getComputedStyle(token.element(), '::after').height)
    )
  ).toBe(44);
});
