import { expect, spyOn, test } from 'bun:test';

import { signIn } from '../test/auth';
import { call, idle } from '../test/client';
import app, { logRequest } from './app';
import { harness } from './harness';

function file(name: string, type: string) {
  return new File([new Uint8Array(2_000_000)], name, { type });
}

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

test('signed-in requests over 1 MB are refused unless they carry a file or a message', async () => {
  const headers = await signIn();

  const send = async (
    method: string,
    path: string,
    field: string,
    value: File
  ) => {
    const body = new FormData();

    body.append(field, value);

    return (await app.request(`/api${path}`, { body, headers, method })).status;
  };

  const message = await call(headers, 'POST', '/conversations', {
    content: 'a'.repeat(2_000_000),
  });

  await idle(message.body.id);

  expect({
    message: message.status,
    picture: await send(
      'PUT',
      '/profile/picture',
      'picture',
      file('foo.png', 'image/png')
    ),
    preferences: await call(headers, 'PATCH', '/preferences', {
      foo: 'a'.repeat(1_000_000),
      theme: 'dark',
    }),
    upload: await send(
      'POST',
      '/uploads',
      'document',
      file('foo.pdf', 'application/pdf')
    ),
  }).toEqual({
    message: 201,
    picture: 200,
    preferences: {
      body: { error: 'Request body is too large' },
      status: 413,
    },
    upload: 201,
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
