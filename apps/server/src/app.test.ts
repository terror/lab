import { expect, spyOn, test } from 'bun:test';

import { call } from '../test/client';
import { logRequest } from './app';
import { harness } from './harness';

test('health reports ok', async () => {
  expect(await call(new Headers(), 'GET', '/health')).toEqual({
    body: { status: 'ok' },
    status: 200,
  });
});

test('auth requests with oversized bodies are rejected', async () => {
  expect(
    await call(new Headers(), 'POST', '/auth/sign-in/social', {
      callbackURL: '/',
      foo: 'a'.repeat(100_000),
      provider: 'google',
    })
  ).toEqual({
    body: { error: 'Request body is too large' },
    status: 413,
  });
});

test('health fails when the harness is not running', async () => {
  spyOn(harness, 'inspect').mockResolvedValueOnce({
    scheduling: 'closing',
    submissions: [],
    tasks: [],
  });

  expect(await call(new Headers(), 'GET', '/health')).toEqual({
    body: { error: 'Harness is not running' },
    status: 503,
  });
});

test('request logs leave out query strings', () => {
  const log = spyOn(console, 'log').mockImplementation(() => undefined);

  logRequest('<-- GET /api/search?q=foo');
  logRequest('--> GET /api/search?q=foo 200 1ms');

  expect(log.mock.calls).toEqual([
    ['<-- GET /api/search'],
    ['--> GET /api/search 200 1ms'],
  ]);
});
