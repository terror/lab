import { schema } from '@lab/db';
import { expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';

import { signIn } from '../test/auth';
import { call, create } from '../test/client';
import { db } from './db';
import { projectAll } from './projections';

test('projections are restored from the harness', async () => {
  const headers = await signIn();

  const id = await create(headers);

  await db
    .update(schema.conversation)
    .set({ lastMessageAt: new Date(0), title: null })
    .where(eq(schema.conversation.id, id));

  await projectAll();

  const { body } = await call(headers, 'GET', `/conversations/${id}/entries`);

  const message = body.items.find(
    ({ kind }: { kind: string }) => kind === 'lab.message'
  );

  expect(
    await db
      .select({
        lastMessageAt: schema.conversation.lastMessageAt,
        title: schema.conversation.title,
      })
      .from(schema.conversation)
      .where(eq(schema.conversation.id, id))
  ).toEqual([
    { lastMessageAt: new Date(message.model[0].timestamp), title: 'foo' },
  ]);
});
