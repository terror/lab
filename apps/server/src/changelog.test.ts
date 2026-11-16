import { expect, spyOn, test } from 'bun:test';

import { call } from '../test/client';

test('the running version is reported', async () => {
  expect(await call(new Headers(), 'GET', '/version')).toEqual({
    body: { version: 'development' },
    status: 200,
  });
});

test('the changelog lists user-facing pull requests newest first', async () => {
  const responses = new Map<string, unknown>([
    [
      'compare',
      {
        commits: [
          {
            commit: {
              author: { date: '2026-11-16T00:00:00Z' },
              message: 'Add foo (#12)\n\n* bar',
            },
            html_url: 'https://github.com/terror/lab/commit/aaa',
            sha: 'aaa',
          },
          {
            commit: { author: null, message: 'Fix baz\n\nQux the baz.' },
            html_url: 'https://github.com/terror/lab/commit/bbb',
            sha: 'bbb',
          },
          {
            commit: { author: null, message: 'Refactor qux (#13)' },
            html_url: 'https://github.com/terror/lab/commit/ccc',
            sha: 'ccc',
          },
        ],
      },
    ],
    [
      'pulls',
      [
        {
          body: 'Foo the bar.\n\nhttps://example.com/foo.mp4',
          labels: [{ name: 'user-facing' }],
          number: 12,
        },
        { body: 'Qux the quux.', labels: [], number: 13 },
      ],
    ],
  ]);

  const github = async (input: string | URL) => {
    const [, kind = ''] =
      /repos\/[^/]+\/[^/]+\/(compare|pulls)/.exec(String(input)) ?? [];

    return Response.json(responses.get(kind));
  };

  spyOn(globalThis, 'fetch').mockImplementation(github as typeof fetch);

  expect(await call(new Headers(), 'GET', '/changelog?since=abcdef0')).toEqual({
    body: {
      entries: [
        {
          date: '2026-11-16T00:00:00Z',
          description: 'Foo the bar.',
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
