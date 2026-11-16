import {
  latestVersionQueryOptions,
  loadedVersionQueryOptions,
} from '@/lib/version';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import { Updates } from './updates';

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

test('a tab behind the latest deploy leaves the seen version alone', async () => {
  window.localStorage.setItem('lab:seen-version', JSON.stringify('bbbbbbb'));

  const fetch = vi.spyOn(window, 'fetch').mockImplementation(async (input) => {
    const url = input instanceof Request ? input.url : input.toString();

    if (url.includes('/changelog')) {
      return Response.json({ entries: [], version: 'bbbbbbb' });
    }

    return Response.json({ version: 'bbbbbbb' });
  });

  const client = new QueryClient();

  client.setQueryData(loadedVersionQueryOptions.queryKey, {
    version: 'aaaaaaa',
  });

  await render(
    <QueryClientProvider client={client}>
      <Updates />
    </QueryClientProvider>
  );

  await expect
    .poll(() => client.getQueryData(latestVersionQueryOptions.queryKey))
    .toEqual({ version: 'bbbbbbb' });

  expect({
    changelog: fetch.mock.calls.some(([input]) =>
      String(input instanceof Request ? input.url : input).includes(
        '/changelog'
      )
    ),
    seen: window.localStorage.getItem('lab:seen-version'),
  }).toEqual({ changelog: false, seen: JSON.stringify('bbbbbbb') });
});
