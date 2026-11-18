import { requestUrl, stubFetch } from '@/test/helpers';
import { expect, test } from 'vitest';

import { artifactCalls } from './artifacts';

test('artifact calls reach the store one at a time', async () => {
  const pending: (() => void)[] = [];

  const fetch = stubFetch((_url, init) => {
    if (init?.method === 'GET') {
      return Response.json({ value: '1' });
    }

    return new Promise((resolve) =>
      pending.push(() => resolve(new Response(null, { status: 204 })))
    );
  });

  const calls = artifactCalls(1, 'foo');

  const results = Promise.all([
    calls('store.set', { key: 'bar', value: '1' }),
    calls('store.get', { key: 'bar' }),
    calls('store.delete', { key: 'bar' }),
    calls('baz', {}).catch((error: Error) => error.message),
  ]);

  await expect.poll(() => pending.length).toBe(1);

  const waiting = fetch.mock.calls.length;

  pending[0]?.();

  await expect.poll(() => pending.length).toBe(2);

  pending[1]?.();

  expect({
    requests: fetch.mock.calls.map(([input, init]) => {
      const url = requestUrl(input);

      return [init?.method, `${url.pathname}${url.search}`, init?.body];
    }),
    results: await results,
    waiting,
  }).toEqual({
    requests: [
      [
        'PUT',
        '/api/conversations/1/artifacts/foo/state?key=bar',
        '{"value":"1"}',
      ],
      ['GET', '/api/conversations/1/artifacts/foo/state?key=bar', undefined],
      ['DELETE', '/api/conversations/1/artifacts/foo/state?key=bar', undefined],
    ],
    results: [undefined, '1', undefined, 'lab.baz isn’t available.'],
    waiting: 1,
  });
});
