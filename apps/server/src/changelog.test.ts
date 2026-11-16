import { expect, spyOn, test } from 'bun:test';

import { call } from '../test/client';

test('the running version is reported', async () => {
  expect(await call(new Headers(), 'GET', '/version')).toEqual({
    body: { version: 'development' },
    status: 200,
  });
});

test('the changelog lists merged pull requests newest first', async () => {
  spyOn(globalThis, 'fetch').mockResolvedValueOnce(
    Response.json({
      commits: [
        {
          commit: {
            author: { date: '2026-11-16T00:00:00Z' },
            message: 'Add foo (#12)\n\nbar',
          },
          html_url: 'https://github.com/terror/lab/commit/aaa',
          sha: 'aaa',
        },
        {
          commit: { author: null, message: 'Fix baz' },
          html_url: 'https://github.com/terror/lab/commit/bbb',
          sha: 'bbb',
        },
      ],
    })
  );

  expect(await call(new Headers(), 'GET', '/changelog?since=abcdef0')).toEqual({
    body: {
      entries: [
        {
          date: null,
          sha: 'bbb',
          title: 'Fix baz',
          url: 'https://github.com/terror/lab/commit/bbb',
        },
        {
          date: '2026-11-16T00:00:00Z',
          sha: 'aaa',
          title: 'Add foo',
          url: 'https://github.com/terror/lab/pull/12',
        },
      ],
      version: 'development',
    },
    status: 200,
  });
});
