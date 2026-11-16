import { schema } from '@lab/db';
import { expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';

import { signIn } from '../test/auth';
import { call, create } from '../test/client';
import { db } from './db';
import { backfillUsage, flushUsage } from './usage';

test('usage is summarized from assistant responses', async () => {
  const headers = await signIn();

  const id = await create(headers);

  await flushUsage();

  await db
    .delete(schema.usageEvent)
    .where(eq(schema.usageEvent.conversationId, id));

  await backfillUsage();

  const { body } = await call(headers, 'GET', '/usage?days=7');

  expect({
    conversations: body.conversations,
    days: body.daily.length,
    models: body.models,
    summary: body.summary,
  }).toEqual({
    conversations: [{ cost: 0, id, title: 'foo' }],
    days: 7,
    models: [
      {
        cost: 0,
        input: 0,
        model: 'anthropic/claude-sonnet-5.5',
        name: 'anthropic/claude-sonnet-5.5',
        output: 1,
        provider: 'vercel-ai-gateway',
        responses: 1,
      },
    ],
    summary: {
      cacheRead: 0,
      cacheWrite: 32,
      cost: 0,
      input: 0,
      output: 1,
      responses: 1,
    },
  });
});
