import { QueryClient } from '@tanstack/react-query';
import { expect, test, vi } from 'vitest';

import { refreshAgentWrites } from './agent-writes';

test('a finished run refreshes every query a tool can write', async () => {
  const queryClient = new QueryClient();

  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

  await refreshAgentWrites(queryClient);

  expect(invalidate.mock.calls.map(([filters]) => filters?.queryKey)).toEqual([
    ['conversations'],
    ['memory'],
    ['preferences'],
    ['projects'],
    ['library'],
    ['schedules'],
    ['skills'],
  ]);
});
