import { preferencesQueryOptions } from '@/lib/preferences';
import { renderHookWithQuery } from '@/test/helpers';
import { defaultPreferences } from '@lab/server/schemas';
import { QueryClient } from '@tanstack/react-query';
import { act } from 'react';
import { afterEach, expect, test, vi } from 'vitest';

import { useMoment } from './moment';

vi.mock('./moments', () => ({
  moments: {
    'foo.bar': {
      budget: [
        { max: 3, per: 'ever' },
        { max: 2, per: 'day' },
      ],
      ms: 100,
      quiet: 'skip',
      reduced: 'still',
      tier: 'run',
      use: 'Foo.',
    },
  },
}));

afterEach(() => {
  vi.useRealTimers();
});

const useShot = useMoment as unknown as (id: string) => {
  play: () => boolean;
};

test('two limits counted under one key each keep their own count', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 18, 9));

  const client = new QueryClient();

  client.setQueryData(preferencesQueryOptions.queryKey, defaultPreferences);

  const { result } = await renderHookWithQuery(
    () => useShot('foo.bar'),
    client
  );

  const plays: boolean[] = [];

  const play = async () => plays.push(await act(() => result.current.play()));

  await play();
  await play();
  await play();

  vi.setSystemTime(new Date(2026, 10, 19, 9));

  await play();
  await play();

  expect(plays).toEqual([true, true, false, true, false]);
});
