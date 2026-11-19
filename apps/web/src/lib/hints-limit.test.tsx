import { preferencesQueryOptions } from '@/lib/preferences';
import { renderHookWithQuery, stubFetch } from '@/test/helpers';
import { defaultPreferences } from '@lab/server/schemas';
import { QueryClient } from '@tanstack/react-query';
import { expect, test } from 'vitest';

import { useHint } from './hints';

test('a claim the full ledger refuses spends the session instead of retrying', async () => {
  const client = new QueryClient();

  client.setQueryData(preferencesQueryOptions.queryKey, defaultPreferences);

  const fetch = stubFetch(() =>
    Response.json({ fresh: false, preferences: defaultPreferences })
  );

  const { result } = await renderHookWithQuery(
    () => [useHint('foo', true).show, useHint('bar', true).show],
    client
  );

  await expect.poll(() => fetch.mock.calls.length).toBe(1);

  await new Promise((resolve) => setTimeout(resolve, 100));

  expect([fetch.mock.calls.length, result.current]).toEqual([
    1,
    [false, false],
  ]);
});
