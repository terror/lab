import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import type { ConversationId } from '@earendil-works/pi-durable';
import { schema } from '@lab/db';
import { expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';

import { signIn } from '../test/auth';
import { call, create, idle, settle } from '../test/client';
import { db } from './db';
import { harness } from './harness';

test('a chat can be compacted with the helper model', async () => {
  const headers = await signIn();

  const id = await create(headers);

  await call(headers, 'POST', `/conversations/${id}/messages`, {
    content: 'bar',
  });

  await idle(id);

  const conversation = await harness.conversation(
    id as ConversationId,
    BACKGROUND_CONTEXT
  );

  await conversation?.configure(
    { compaction: { keepRecentTokens: 1 } },
    BACKGROUND_CONTEXT
  );

  const compacted = await call(headers, 'POST', `/conversations/${id}/compact`);

  await settle(id);

  const { body } = await call(
    headers,
    'GET',
    `/conversations/${id}/entries?order=ascending`
  );

  const kinds = await db
    .select({ kind: schema.usageEvent.kind, model: schema.usageEvent.model })
    .from(schema.usageEvent)
    .where(eq(schema.usageEvent.conversationId, id));

  expect({
    compacted: compacted.status,
    entries: body.items
      .filter(({ kind }: { kind: string }) => kind === 'pi.compaction')
      .map(({ kind }: { kind: string }) => kind),
    usage: kinds.filter(({ kind }) => kind === 'compaction'),
  }).toEqual({
    compacted: 202,
    entries: ['pi.compaction'],
    usage: [{ kind: 'compaction', model: 'anthropic/claude-haiku-5.5' }],
  });
});
