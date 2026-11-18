import { renderHookWithQuery, stubFetch } from '@/test/helpers';
import { expect, test } from 'vitest';

import { usePreference } from './preferences';

test('settings saved in this browser move to the server once', async () => {
  window.localStorage.setItem('lab:theme', JSON.stringify('light'));

  const fetch = stubFetch((_url, init) =>
    Response.json({
      preferences: {
        chatSort: 'activity',
        lineNumbers: false,
        theme: init?.method === 'PATCH' ? 'light' : 'system',
      },
    })
  );

  const { result } = await renderHookWithQuery(() => usePreference('theme'));

  await expect.poll(() => result.current[0]).toBe('light');

  expect({
    calls: fetch.mock.calls.map(([, init]) => [init?.method, init?.body]),
    legacy: window.localStorage.getItem('lab:theme'),
  }).toEqual({
    calls: [['PATCH', JSON.stringify({ theme: 'light' })]],
    legacy: null,
  });
});

test('settings cached before a new one existed still apply while loading', async () => {
  window.localStorage.setItem(
    'lab:preferences',
    JSON.stringify({ chatSort: 'title', lineNumbers: true, theme: 'dark' })
  );

  stubFetch(() => new Promise<Response>(() => {}));

  const { result } = await renderHookWithQuery(() => [
    usePreference('theme')[0],
    usePreference('personality')[0],
  ]);

  expect(result.current).toEqual(['dark', 'default']);
});
