import { schema } from '@lab/db';
import { expect, test } from 'bun:test';
import { and, eq } from 'drizzle-orm';

import { signIn } from '../test/auth';
import { call, create } from '../test/client';
import { db } from './db';
import { flushHelperUsage } from './helper-usage';
import { backfillUsage, flushUsage } from './usage';

test('usage is summarized from assistant responses', async () => {
  const headers = await signIn();

  const id = await create(headers);

  await flushUsage();
  await flushHelperUsage();

  await db
    .delete(schema.usageEvent)
    .where(
      and(
        eq(schema.usageEvent.conversationId, id),
        eq(schema.usageEvent.kind, 'response')
      )
    );

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
      {
        cost: 0,
        input: 0,
        model: 'anthropic/claude-haiku-5.5',
        name: 'anthropic/claude-haiku-5.5',
        output: 1,
        provider: 'vercel-ai-gateway',
        responses: 0,
      },
    ],
    summary: {
      cacheRead: 0,
      cacheWrite: 64,
      cost: 0,
      input: 0,
      output: 2,
      responses: 1,
    },
  });
});
