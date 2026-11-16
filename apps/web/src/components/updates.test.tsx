import {
  latestVersionQueryOptions,
  loadedVersionQueryOptions,
} from '@/lib/version';
import { fetchedPaths, renderWithQuery, stubFetch } from '@/test/helpers';
import { QueryClient } from '@tanstack/react-query';
import { expect, test } from 'vitest';

import { Updates } from './updates';

test('a tab behind the latest deploy leaves the seen version alone', async () => {
  window.localStorage.setItem('lab:seen-version', JSON.stringify('bbbbbbb'));

  const fetch = stubFetch(({ pathname }) =>
    pathname.endsWith('/changelog')
      ? Response.json({ entries: [], version: 'bbbbbbb' })
      : Response.json({ version: 'bbbbbbb' })
  );

  const client = new QueryClient();

  client.setQueryData(loadedVersionQueryOptions.queryKey, {
    version: 'aaaaaaa',
  });

  await renderWithQuery(<Updates />, client);

  await expect
    .poll(() => client.getQueryData(latestVersionQueryOptions.queryKey))
    .toEqual({ version: 'bbbbbbb' });

  expect({
    changelog: fetchedPaths(fetch).some((path) => path.endsWith('/changelog')),
    seen: window.localStorage.getItem('lab:seen-version'),
  }).toEqual({ changelog: false, seen: JSON.stringify('bbbbbbb') });
});
