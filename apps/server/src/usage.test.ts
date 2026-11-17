import { schema } from '@lab/db';
import { expect, test } from 'bun:test';
import { and, eq } from 'drizzle-orm';

import { signIn } from '../test/auth';
import { call, create, settle } from '../test/client';
import { db } from './db';
import { backfillUsage } from './usage';

test('usage is summarized from assistant responses', async () => {
  const headers = await signIn();

  const id = await create(headers);

  await settle();

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

  const written = (
    await db
      .select({ cacheWrite: schema.usageEvent.cacheWrite })
      .from(schema.usageEvent)
      .where(eq(schema.usageEvent.conversationId, id))
  ).reduce((total, { cacheWrite }) => total + cacheWrite, 0);

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
        input: 43,
        model: 'anthropic/claude-haiku-5.5',
        name: 'anthropic/claude-haiku-5.5',
        output: 1,
        provider: 'vercel-ai-gateway',
        responses: 0,
      },
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
      cacheWrite: written,
      cost: 0,
      input: 43,
      output: 2,
      responses: 1,
    },
  });
});

test('a monthly budget tracks spend this month', async () => {
  const headers = await signIn();

  const id = await create(headers);

  await settle();

  await db
    .update(schema.usageEvent)
    .set({ cost: 1.5 })
    .where(
      and(
        eq(schema.usageEvent.conversationId, id),
        eq(schema.usageEvent.kind, 'response')
      )
    );

  expect([
    await call(headers, 'GET', '/usage/budget'),
    await call(headers, 'PUT', '/usage/budget', { limit: 2 }),
    await call(headers, 'PUT', '/usage/budget', { limit: null }),
  ]).toEqual([
    { body: { limit: null, spent: 1.5 }, status: 200 },
    { body: { limit: 2, spent: 1.5 }, status: 200 },
    { body: { limit: null, spent: 1.5 }, status: 200 },
  ]);
});

test('trashed chats are left out of the most expensive chats', async () => {
  const headers = await signIn();

  const id = await create(headers);

  await call(headers, 'DELETE', `/conversations/${id}`);

  await settle();

  const { body } = await call(headers, 'GET', '/usage?days=7');

  expect(body.conversations).toEqual([]);
});
