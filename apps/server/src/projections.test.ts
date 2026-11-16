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
    .set({ title: null })
    .where(eq(schema.conversation.id, id));

  await projectAll();

  expect(await call(headers, 'GET', '/conversations')).toEqual({
    body: { conversations: [{ id, title: 'foo' }], next: null },
    status: 200,
  });
});
