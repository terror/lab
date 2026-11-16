import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import type { ConversationId } from '@earendil-works/pi-durable';
import { schema } from '@lab/db';
import { TitleDoc } from '@lab/harness';
import { expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';

import { signIn } from '../test/auth';
import { call, create } from '../test/client';
import { db } from './db';
import { harness } from './harness';
import { backfillTitles } from './titles';

test('titles are backfilled from the harness', async () => {
  const headers = await signIn();

  const id = await create(headers);

  await db
    .update(schema.conversation)
    .set({ title: null })
    .where(eq(schema.conversation.id, id));

  const conversation = await harness.conversation(
    id as ConversationId,
    BACKGROUND_CONTEXT
  );

  await conversation?.commit(async (tx) => {
    (await tx.doc(TitleDoc, id as ConversationId)).title = 'bar';
  }, BACKGROUND_CONTEXT);

  await backfillTitles(harness);

  expect(await call(headers, 'GET', '/conversations')).toEqual({
    body: { conversations: [{ id, title: 'bar' }], next: null },
    status: 200,
  });
});
