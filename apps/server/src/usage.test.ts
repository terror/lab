import { schema } from '@lab/db';
import { expect, test } from 'bun:test';
import { and, eq } from 'drizzle-orm';

import { signIn, signInAdmin } from '../test/auth';
import { call, create, settle } from '../test/client';
import { db } from './db';
import { env } from './env';
import { conversationOwner } from './records';
import { usagePipeline } from './usage';

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

  await usagePipeline.backfill();

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

test('models outside the catalog get a readable name', async () => {
  const headers = await signIn();

  const id = await create(headers);

  await settle();

  await db.insert(schema.usageEvent).values({
    cacheRead: 0,
    cacheWrite: 0,
    conversationId: id,
    cost: 0,
    createdAt: new Date(),
    input: 0,
    kind: 'image',
    model: 'foo/bar-1.5-baz',
    output: 0,
    ownerId: (await conversationOwner(id)) ?? '',
    provider: 'vercel-ai-gateway',
  });

  const { body } = await call(headers, 'GET', '/usage?days=7');

  expect(
    body.models.map(({ model, name }: { model: string; name: string }) => [
      model,
      name,
    ])
  ).toEqual([
    ['anthropic/claude-haiku-5.5', 'anthropic/claude-haiku-5.5'],
    ['anthropic/claude-sonnet-5.5', 'anthropic/claude-sonnet-5.5'],
    ['foo/bar-1.5-baz', 'Bar 1.5 Baz'],
  ]);
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

test('users other than the admin stop at the monthly limit', async () => {
  const headers = await signIn();

  const id = await create(headers);

  await settle();

  const ownerId = (await conversationOwner(id)) ?? '';

  await db.insert(schema.usageEvent).values({
    cacheRead: 0,
    cacheWrite: 0,
    conversationId: id,
    cost: 2,
    createdAt: new Date(),
    input: 0,
    model: 'foo',
    output: 0,
    ownerId,
    provider: 'foo',
  });

  env.LAB_MONTHLY_LIMIT = 1;

  try {
    expect({
      admin: (
        await call(await signInAdmin(), 'POST', '/conversations', {
          content: 'foo',
        })
      ).status,
      user: await call(headers, 'POST', `/conversations/${id}/messages`, {
        content: 'foo',
      }),
    }).toEqual({
      admin: 201,
      user: {
        body: { error: 'You’ve used this month’s $1.00 limit' },
        status: 402,
      },
    });
  } finally {
    env.LAB_MONTHLY_LIMIT = undefined;
  }
});
