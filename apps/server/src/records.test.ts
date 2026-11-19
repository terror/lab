import { schema } from '@lab/db';
import { expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';

import { signIn } from '../test/auth';
import { call, create } from '../test/client';
import { db } from './db';
import { owners, serial } from './records';

test('deleted chats keep their owner for late usage', async () => {
  const headers = await signIn();

  const id = await create(headers);

  const [row] = await db
    .select({ ownerId: schema.conversation.ownerId })
    .from(schema.conversation)
    .where(eq(schema.conversation.id, id));

  await call(headers, 'DELETE', `/conversations/${id}`);
  await call(headers, 'DELETE', `/trash/conversation/${id}`);

  expect(await owners([id])).toEqual(new Map([[id, row?.ownerId ?? '']]));
});

test('a flush waits only for work queued before it', async () => {
  const queue = serial();

  const order: string[] = [];

  queue.run(async () => {
    order.push('foo');
  });

  const flushed = queue.flush().then(() => order.push('flushed'));

  queue.run(async () => {
    order.push('bar');
  });

  await flushed;

  await queue.flush();

  expect(order).toEqual(['foo', 'flushed', 'bar']);
});
