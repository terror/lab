import { renderHookWithQuery, requestUrl, stubFetch } from '@/test/helpers';
import { expect, test } from 'vitest';

import { useLibrarySearch } from './library';

test('library search waits for typing to settle', async () => {
  const fetch = stubFetch(() => Response.json({ items: [], next: null }));

  const { act, result } = await renderHookWithQuery(() =>
    useLibrarySearch('file')
  );

  await act(() => result.current.setSearch('f'));
  await act(() => result.current.setSearch('fo'));
  await act(() => result.current.setSearch('foo'));

  await expect.poll(() => result.current.query).toBe('foo');

  await expect.poll(() => fetch.mock.calls.length).toBe(2);

  await expect.poll(() => result.current.empty).toBe(true);

  const searches = fetch.mock.calls.map(([input]) =>
    requestUrl(input).searchParams.get('search')
  );

  expect({ empty: result.current.empty, searches }).toEqual({
    empty: true,
    searches: [null, 'foo'],
  });
});
