import { expect, spyOn, test } from 'bun:test';

import { call } from '../test/client';
import { harness } from './harness';

test('health reports ok', async () => {
  expect(await call(new Headers(), 'GET', '/health')).toEqual({
    body: { status: 'ok' },
    status: 200,
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
