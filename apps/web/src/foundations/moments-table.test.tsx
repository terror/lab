import { confetti } from '@/lib/confetti';
import { moments } from '@/lib/moments';
import { renderWithQuery } from '@/test/helpers';
import { expect, test, vi } from 'vitest';

import { MomentsTable } from './moments-table';

vi.mock('@/lib/confetti', () => ({ confetti: vi.fn() }));

test('the table lists every moment and replays one that spent its budget', async () => {
  const { screen } = await renderWithQuery(<MomentsTable />);

  const replay = screen.getByRole('button', { name: 'Replay plan.complete' });

  await replay.click();
  await replay.click();

  await expect.poll(() => vi.mocked(confetti).mock.calls.length).toBe(2);

  expect(
    [...screen.container.querySelectorAll('tbody tr:has(code)')]
      .map((row) => row.querySelector('code')?.textContent ?? '')
      .toSorted()
  ).toEqual(Object.keys(moments));
});
