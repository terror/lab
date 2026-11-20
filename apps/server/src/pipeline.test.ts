import { schema } from '@lab/db';
import { SQL } from 'bun';
import { expect, spyOn, test } from 'bun:test';
import { DrizzleQueryError, and, eq, sql } from 'drizzle-orm';

import { signIn } from '../test/auth';
import { call, chat, create } from '../test/client';
import { db } from './db';
import { historyPipeline } from './history';
import { entryPipeline } from './pipeline';

test('the backfill skips a row that fails to save and continues', async () => {
  const headers = await signIn();

  const [foo, bar] = [await create(headers), await create(headers)];

  const failure = await db
    .execute(sql`select ${'baz'}::integer`)
    .catch((error: unknown) => error);

  const report = spyOn(console, 'error').mockImplementation(() => undefined);

  const saved = new Set<number>();

  let failing: number | undefined;

  await entryPipeline({
    keep: () => true,
    name: 'qux',
    rows: (entries) =>
      entries.map(({ conversationId, id }) => ({
        conversationId,
        entryId: id,
      })),
    store: async (rows) => {
      failing ??= rows.find(
        ({ conversationId }) => conversationId === foo
      )?.entryId;

      if (
        rows.some(
          ({ conversationId, entryId }) =>
            conversationId === foo && entryId === failing
        )
      ) {
        throw failure;
      }

      for (const { conversationId } of rows) {
        saved.add(conversationId);
      }
    },
  }).backfill();

  expect({
    reports: report.mock.calls.filter(
      ([message]) =>
        typeof message === 'string' && message.startsWith('Skipped')
    ),
    saved: [foo, bar].filter((id) => saved.has(id)),
  }).toEqual({
    reports: [
      [
        `Skipped entry ${failing} of conversation ${foo} in the qux pipeline`,
        failure,
      ],
    ],
    saved: [foo, bar],
  });
});

test('a backfill retries a failed write before advancing its checkpoint', async () => {
  const headers = await signIn();

  const id = await chat(headers, { content: 'bar' });

  const table = schema.messageText;

  const checkpoint = and(
    eq(schema.backfillCheckpoint.pipeline, 'history'),
    eq(schema.backfillCheckpoint.conversationId, id)
  );

  await db
    .delete(table)
    .where(and(eq(table.conversationId, id), eq(table.role, 'user')));
  await db.delete(schema.backfillCheckpoint).where(checkpoint);

  await db.execute(sql`
    create function foo() returns trigger language plpgsql as $$
    begin
      raise exception 'bar' using errcode = '40001';
    end
    $$
  `);

  await db.execute(sql`
    create trigger foo before insert on message_text
    for each row when (new.conversation_id = ${sql.raw(String(id))})
    execute function foo()
  `);

  spyOn(console, 'error').mockImplementation(() => undefined);

  const failure = await historyPipeline
    .backfill()
    .then(
      () => undefined,
      (error: unknown) =>
        error instanceof DrizzleQueryError ? error.cause : error
    )
    .finally(async () => {
      await db.execute(sql`drop trigger foo on message_text`);
      await db.execute(sql`drop function foo()`);
    });

  const checkpoints = await db
    .select({ entryId: schema.backfillCheckpoint.entryId })
    .from(schema.backfillCheckpoint)
    .where(checkpoint);

  await historyPipeline.backfill();
  await historyPipeline.backfill();

  const { body } = await call(headers, 'GET', '/search?q=bar');

  expect({
    checkpoints,
    error:
      failure instanceof SQL.PostgresError
        ? { code: failure.errno, message: failure.message }
        : failure,
    found: body.chats.map((match: { id: number }) => match.id),
    rows: await db
      .select({ role: table.role, text: table.text })
      .from(table)
      .where(eq(table.conversationId, id))
      .orderBy(table.entryId),
  }).toEqual({
    checkpoints: [],
    error: { code: '40001', message: 'bar' },
    found: [id],
    rows: [
      { role: 'user', text: 'bar' },
      { role: 'assistant', text: 'foo' },
    ],
  });
});

test('unrecognized storage failures stop the backfill', async () => {
  await create(await signIn());

  const invalid = await db
    .execute(sql`select ${'foo'}::integer`)
    .catch((error: unknown) => error);

  const failure = new Error('bar');

  async function check(split: boolean) {
    const error = await entryPipeline({
      keep: () => true,
      name: 'baz',
      rows: (entries) =>
        entries.map(({ conversationId, id }) => ({
          conversationId,
          entryId: id,
        })),
      store: async (rows) => {
        throw split && rows.length > 1 ? invalid : failure;
      },
    })
      .backfill()
      .catch((cause: unknown) => cause);

    expect(error).toBe(failure);
  }

  await check(false);
  await check(true);
});
