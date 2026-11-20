import '@/index.css';
import { preferencesQueryOptions } from '@/lib/preferences';
import { renderWithQuery } from '@/test/helpers';
import { defaultPreferences } from '@lab/server/schemas';
import { QueryClient } from '@tanstack/react-query';
import { expect, test } from 'vitest';
import { cdp } from 'vitest/browser';

import { Brief, BriefToken } from './brief';

async function renderBrief() {
  const client = new QueryClient();

  client.setQueryData(preferencesQueryOptions.queryKey, defaultPreferences);

  const { screen } = await renderWithQuery(
    <Brief className='w-20'>
      <BriefToken count={2}>foo</BriefToken>{' '}
      <BriefToken count={3}>bar</BriefToken>
    </Brief>,
    client
  );

  return {
    first: screen.getByRole('button', { name: '2 foo' }).element(),
    screen,
    second: screen.getByRole('button', { name: '3 bar' }).element(),
  };
}

test('with a mouse a count is no wider than its words', async () => {
  const { first } = await renderBrief();

  const words = document.createRange();

  words.selectNodeContents(first);

  expect(
    Math.round(
      first.getBoundingClientRect().right - words.getBoundingClientRect().right
    )
  ).toBe(4);
});

test('on a touch screen a count reaches 44px into free space, and a tap on a count lands on that count', async ({
  onTestFinished,
}) => {
  await cdp().send('Emulation.setTouchEmulationEnabled', { enabled: true });

  onTestFinished(async () => {
    await cdp().send('Emulation.setTouchEmulationEnabled', { enabled: false });
  });

  const { first, second } = await renderBrief();

  const { bottom, left } = first.getBoundingClientRect();

  expect([
    Math.round(Number.parseFloat(getComputedStyle(first, '::after').height)),
    document.elementFromPoint(left + 4, bottom - 2)?.closest('button')
      ?.textContent,
    document.elementFromPoint(left + 4, bottom + 2)?.closest('button')
      ?.textContent,
  ]).toEqual([44, first.textContent, second.textContent]);
});
