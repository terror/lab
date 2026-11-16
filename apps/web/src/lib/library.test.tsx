import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { expect, test, vi } from 'vitest';
import { renderHook } from 'vitest-browser-react';

import { useLibrarySearch } from './library';

test('library search waits for typing to settle', async () => {
  const fetch = vi
    .spyOn(window, 'fetch')
    .mockImplementation(async () => Response.json({ items: [], next: null }));

  const client = new QueryClient();

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  const { act, result } = await renderHook(() => useLibrarySearch('file'), {
    wrapper,
  });

  await act(() => result.current.setSearch('f'));
  await act(() => result.current.setSearch('fo'));
  await act(() => result.current.setSearch('foo'));

  await expect.poll(() => result.current.query).toBe('foo');

  await expect.poll(() => fetch.mock.calls.length).toBe(2);

  await expect.poll(() => result.current.empty).toBe(true);

  const searches = fetch.mock.calls.map(([input]) =>
    new URL(input instanceof Request ? input.url : input).searchParams.get(
      'search'
    )
  );

  fetch.mockRestore();

  expect({ empty: result.current.empty, searches }).toEqual({
    empty: true,
    searches: [null, 'foo'],
  });
});
