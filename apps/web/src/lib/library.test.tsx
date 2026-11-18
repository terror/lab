import {
  fetchedPaths,
  renderHookWithQuery,
  requestUrl,
  stubFetch,
} from '@/test/helpers';
import { expect, test } from 'vitest';

import { useLibraryImages, useLibrarySearch } from './library';

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

test('artifact image references resolve to the viewer’s library images', async () => {
  const fetch = stubFetch(({ pathname }) =>
    pathname === '/api/library/1'
      ? new Response('foo', { headers: { 'content-type': 'image/png' } })
      : new Response('bar', { headers: { 'content-type': 'text/plain' } })
  );

  const { result } = await renderHookWithQuery(() =>
    useLibraryImages(
      '<img src="lab-image:1"><img src="lab-image:2"><b style="background:url(lab-image:1)">'
    )
  );

  await expect.poll(() => result.current).toBeDefined();

  expect({ html: result.current, paths: fetchedPaths(fetch) }).toEqual({
    html: '<img src="data:image/png;base64,Zm9v"><img src="lab-image:2"><b style="background:url(data:image/png;base64,Zm9v)">',
    paths: ['/api/library/1', '/api/library/2'],
  });
});
