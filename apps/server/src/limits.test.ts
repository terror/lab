import { expect, test } from 'bun:test';

import { signIn } from '../test/auth';
import { call } from '../test/client';
import app from './app';

test('users who repeat an action too often are asked to wait', async () => {
  const headers = await signIn();

  const post = () =>
    app.request('/api/connectors', {
      body: '{}',
      headers: {
        ...Object.fromEntries(headers),
        'content-type': 'application/json',
      },
      method: 'POST',
    });

  const statuses = new Array<number>();

  for (let attempt = 0; attempt < 10; attempt += 1) {
    statuses.push((await post()).status);
  }

  const limited = await post();

  expect({
    body: await limited.json(),
    retry: limited.headers.get('retry-after'),
    status: limited.status,
    statuses: new Set(statuses),
  }).toEqual({
    body: { error: 'You’re doing that too often. Try again in 60 seconds.' },
    retry: '60',
    status: 429,
    statuses: new Set([400]),
  });
});

test('computer requests are limited for each user', async () => {
  const headers = await signIn();

  const statuses = new Array<number>();

  for (let attempt = 0; attempt < 31; attempt += 1) {
    statuses.push((await call(headers, 'GET', '/computer')).status);
  }

  expect(statuses).toEqual([...Array.from({ length: 30 }, () => 200), 429]);
});
