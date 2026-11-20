import { requestUrl, stubFetch } from '@/test/helpers';
import { expect, test } from 'vitest';
import { renderHook } from 'vitest-browser-react';

import { artifactCalls, useArtifactActivity } from './artifacts';

test('artifact calls reach the store one at a time and ask only on a gesture', async () => {
  const pending: (() => void)[] = [];

  const fetch = stubFetch((_url, init) => {
    if (init?.method === 'GET') {
      return Response.json({ value: '1' });
    }

    if (init?.method === 'POST') {
      return Response.json({ text: 'qux' });
    }

    return new Promise((resolve) =>
      pending.push(() => resolve(new Response(null, { status: 204 })))
    );
  });

  const calls = artifactCalls(1, 'foo');

  const results = Promise.all([
    calls('store.set', { key: 'bar', value: '1' }, false),
    calls('store.get', { key: 'bar' }, false),
    calls('store.delete', { key: 'bar' }, false),
    calls('baz', {}, true).catch((error: Error) => error.message),
    calls('ask', { prompt: 'bar' }, false).catch(
      (error: Error) => error.message
    ),
  ]);

  await expect.poll(() => pending.length).toBe(1);

  const waiting = fetch.mock.calls.length;

  pending[0]?.();

  await expect.poll(() => pending.length).toBe(2);

  pending[1]?.();

  const answer = await calls('ask', { prompt: 'bar' }, true);

  expect({
    answer,
    requests: fetch.mock.calls.map(([input, init]) => {
      const url = requestUrl(input);

      return [init?.method, `${url.pathname}${url.search}`, init?.body];
    }),
    results: await results,
    waiting,
  }).toEqual({
    answer: 'qux',
    requests: [
      [
        'PUT',
        '/api/conversations/1/artifacts/foo/state?key=bar',
        '{"value":"1"}',
      ],
      ['GET', '/api/conversations/1/artifacts/foo/state?key=bar', undefined],
      ['DELETE', '/api/conversations/1/artifacts/foo/state?key=bar', undefined],
      ['POST', '/api/conversations/1/artifacts/foo/ask', '{"prompt":"bar"}'],
    ],
    results: [
      undefined,
      '1',
      undefined,
      'lab.baz isn’t available.',
      'lab.ask needs a click or key press in the artifact.',
    ],
    waiting: 1,
  });
});

test('an app counts as asking Lab while its lab.ask is pending', async () => {
  const answers: (() => void)[] = [];

  stubFetch(
    () =>
      new Promise((resolve) =>
        answers.push(() => resolve(Response.json({ text: 'baz' })))
      )
  );

  const { result } = await renderHook(() => useArtifactActivity(2, 'foo'));

  const asked = artifactCalls(2, 'foo')('ask', { prompt: 'bar' }, true);

  await expect.poll(() => result.current).toEqual({ asking: 1, saved: 0 });

  answers[0]?.();

  await asked;

  await expect.poll(() => result.current).toEqual({ asking: 0, saved: 0 });
});
