import { expect, spyOn, test } from 'bun:test';

import { signIn } from '../test/auth';
import { call } from '../test/client';

test('the running version is reported', async () => {
  expect(await call(new Headers(), 'GET', '/version')).toEqual({
    body: { version: 'development' },
    status: 200,
  });
});

test('a failed changelog is reported and retried', async () => {
  const headers = await signIn();

  const fetch = spyOn(globalThis, 'fetch').mockImplementation(
    (async () =>
      new Response(null, { status: 500 })) as unknown as typeof globalThis.fetch
  );

  const responses = [
    await call(headers, 'GET', '/changelog?since=fedcba9'),
    await call(headers, 'GET', '/changelog?since=fedcba9'),
  ];

  expect({ calls: fetch.mock.calls.length, responses }).toEqual({
    calls: 4,
    responses: [
      { body: { error: 'Unable to load the changelog' }, status: 502 },
      { body: { error: 'Unable to load the changelog' }, status: 502 },
    ],
  });
});

test('the changelog loads from GitHub once and lists user-facing pull requests newest first', async () => {
  const fixtures = new Map<string, unknown>([
    [
      'commits',
      [
        {
          commit: { author: null, message: 'Add bar (#14)' },
          html_url: 'https://github.com/terror/lab/commit/ddddddd',
          sha: 'ddddddd',
        },
        {
          commit: {
            author: { date: '2026-11-16T00:00:00Z' },
            message: 'Add foo (#12)\n\n* bar',
          },
          html_url: 'https://github.com/terror/lab/commit/ccccccc',
          sha: 'ccccccc',
        },
        {
          commit: { author: null, message: 'Fix baz\n\nQux the baz.' },
          html_url: 'https://github.com/terror/lab/commit/bbbbbbb',
          sha: 'bbbbbbb',
        },
        {
          commit: { author: null, message: 'Refactor qux (#13)' },
          html_url: 'https://github.com/terror/lab/commit/aaaaaaa',
          sha: 'aaaaaaa',
        },
      ],
    ],
    [
      'pulls',
      Array.from({ length: 100 }, (_, index) => ({
        body: 'Qux the quux.',
        labels: [],
        number: 100 + index,
      })),
    ],
    [
      'repo:terror/lab is:pr is:merged label:user-facing',
      {
        items: [
          {
            body: 'Bar the baz.',
            labels: [{ name: 'user-facing' }],
            number: 14,
          },
          {
            body: 'Foo the bar.\n\nhttps://example.com/foo.mp4',
            labels: [{ name: 'user-facing' }],
            number: 12,
          },
        ],
      },
    ],
  ]);

  const github = async (input: string | URL) => {
    const url = new URL(input);

    const [, kind = url.searchParams.get('q') ?? ''] =
      /repos\/[^/]+\/[^/]+\/(commits|pulls)/.exec(url.pathname) ?? [];

    return Response.json(fixtures.get(kind) ?? null);
  };

  const headers = await signIn();

  const fetch = spyOn(globalThis, 'fetch').mockImplementation(
    github as typeof globalThis.fetch
  );

  const bar = {
    date: null,
    description: 'Bar the baz.',
    sha: 'ddddddd',
    title: 'Add bar',
    url: 'https://github.com/terror/lab/pull/14',
  };

  const foo = {
    date: '2026-11-16T00:00:00Z',
    description: 'Foo the bar.',
    sha: 'ccccccc',
    title: 'Add foo',
    url: 'https://github.com/terror/lab/pull/12',
  };

  const responses = [
    await call(headers, 'GET', '/changelog?since=ccccccc'),
    await call(headers, 'GET', '/changelog?since=abcdef0'),
  ];

  expect({ calls: fetch.mock.calls.length, responses }).toEqual({
    calls: 2,
    responses: [
      { body: { entries: [bar], version: 'development' }, status: 200 },
      { body: { entries: [bar, foo], version: 'development' }, status: 200 },
    ],
  });
});
