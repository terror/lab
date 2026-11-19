import { preferencesQueryOptions } from '@/lib/preferences';
import { renderHookWithQuery, stubFetch } from '@/test/helpers';
import { defaultPreferences } from '@lab/server/schemas';
import { QueryClient } from '@tanstack/react-query';
import { expect, test } from 'vitest';

import { useCapabilities } from './capabilities';

test('the catalog takes what was tried from the server and the palette from the ledger', async () => {
  stubFetch(() =>
    Response.json({
      tried: {
        apps: true,
        branches: false,
        helpers: true,
        images: false,
        plan: false,
        schedules: true,
      },
    })
  );

  const client = new QueryClient();

  client.setQueryData(preferencesQueryOptions.queryKey, {
    ...defaultPreferences,
    hints: ['palette'],
  });

  const { result } = await renderHookWithQuery(
    () => useCapabilities()?.map(({ id, tried }) => [id, tried]),
    client
  );

  await expect
    .poll(() => result.current)
    .toEqual([
      ['apps', true],
      ['schedules', true],
      ['images', false],
      ['helpers', true],
      ['plan', false],
      ['branches', false],
      ['palette', true],
    ]);
});
