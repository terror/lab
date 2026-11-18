import { stubFetch } from '@/test/helpers';
import { expect, test } from 'vitest';

import { call, client } from './client';

async function message(respond: () => Promise<Response>) {
  stubFetch(respond);

  return call(
    client.conversations[':id'].read.$post({ param: { id: '1' } })
  ).then(
    () => undefined,
    (error: Error) => error.message
  );
}

test('a failed request explains itself in words', async () => {
  expect([
    await message(() => Promise.reject(new TypeError('Failed to fetch'))),
    await message(async () => new Response('foo', { status: 500 })),
    await message(async () => Response.json({ error: 'bar' }, { status: 400 })),
  ]).toEqual([
    'Couldn’t reach Lab. Check your connection and try again.',
    'Something went wrong. Try again.',
    'bar',
  ]);
});
