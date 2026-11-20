import { confetti } from '@/lib/confetti';
import { type Moment, moments } from '@/lib/moments';
import { preferencesQueryOptions } from '@/lib/preferences';
import { renderWithQuery } from '@/test/helpers';
import { defaultPreferences } from '@lab/server/schemas';
import { QueryClient } from '@tanstack/react-query';
import { expect, test, vi } from 'vitest';

import { MomentsTable } from './moments-table';

vi.mock('@/lib/confetti', () => ({ confetti: vi.fn() }));

const entries: [string, Moment][] = Object.entries(moments);

test('the table lists every moment, replays one that spent its budget, and shows what Quiet keeps', async () => {
  const client = new QueryClient();

  client.setQueryData(preferencesQueryOptions.queryKey, defaultPreferences);

  const { screen } = await renderWithQuery(<MomentsTable />, client);

  const replay = screen.getByRole('button', { name: 'Replay plan.complete' });

  await replay.click();
  await replay.click();

  await expect.poll(() => vi.mocked(confetti).mock.calls.length).toBe(2);

  await screen.getByRole('switch', { name: 'Quiet' }).click();

  const rows = [...screen.container.querySelectorAll('tbody tr:has(code)')].map(
    (row) => ({
      chip: row.querySelector('[data-slot=chip]')?.textContent,
      id: row.querySelector('code')?.textContent ?? '',
    })
  );

  expect({
    kept: rows
      .filter(({ chip }) => chip === 'On')
      .map(({ id }) => id)
      .toSorted(),
    listed: rows.map(({ id }) => id).toSorted(),
  }).toEqual({
    kept: entries
      .filter(([, { ms, quiet }]) => quiet === 'keep' && ms === undefined)
      .map(([id]) => id),
    listed: entries.map(([id]) => id),
  });
});
