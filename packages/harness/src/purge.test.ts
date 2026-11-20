import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import {
  createSession,
  defineDoc,
  defineTask,
} from '@earendil-works/pi-durable';
import {
  applySqliteMigrations,
  SQLITE_MIGRATIONS,
} from '@earendil-works/pi-durable/storage/sqlite';
import {
  openNodeSqliteDatabase,
  openNodeSqliteStorage,
} from '@earendil-works/pi-durable/storage/sqlite/node';
import { expect, test } from 'bun:test';
import { copyFile, mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { purgeConversations } from './purge';

test('purge refuses unknown storage without changing it', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lab-'));
  const source = join(directory, 'foo.sqlite');
  const session = createSession(await openNodeSqliteStorage(source));
  const conversation = await session.commit(
    (tx) => tx.createConversation({ ownership: { kind: 'ownerless' } }),
    BACKGROUND_CONTEXT
  );

  await session.close(BACKGROUND_CONTEXT);

  async function check(change: string) {
    const path = join(directory, 'bar.sqlite');

    await copyFile(source, path);

    const database = new DatabaseSync(path);

    database.exec(change);
    database.close();

    const before = await readFile(path);

    expect(
      await purgeConversations(path, [conversation.id]).catch(
        (error: unknown) => error
      )
    ).toEqual(new Error('Unsupported pi-durable SQLite storage format'));

    expect(await readFile(path)).toEqual(before);
  }

  await check('update durable_schema set version = 3');
  await check('drop table durable_schema');
  await check('delete from durable_schema');
  await check('drop table conversations');
  await check('alter table conversations add column foo text');
  await check('create table foo (id integer)');
  await check(
    'create trigger foo after delete on conversations begin delete from documents; end'
  );
});

test('purge accepts supported schemas, extra indexes, and empty stores', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lab-'));

  async function check(version: number) {
    const path = join(directory, `${version}.sqlite`);
    const database = await openNodeSqliteDatabase(path);

    await applySqliteMigrations(database, SQLITE_MIGRATIONS.slice(0, version));
    await database.exec('create index foo on conversations (id)');
    await database.close();

    expect(await purgeConversations(path, [2])).toEqual([2]);

    const storage = await openNodeSqliteStorage(path);

    await storage.close(BACKGROUND_CONTEXT);
  }

  await check(1);
  await check(2);

  const path = join(directory, 'foo.sqlite');

  expect(await purgeConversations(path, [])).toEqual([]);
  expect(await purgeConversations(path, [2])).toEqual([2]);

  new DatabaseSync(path).close();

  expect(await purgeConversations(path, [2])).toEqual([2]);
});

test('purge removes owned descendants and keeps unrelated documents on reopen', async () => {
  const path = join(await mkdtemp(join(tmpdir(), 'lab-')), 'foo.sqlite');
  const session = createSession(await openNodeSqliteStorage(path));
  const sessionDoc = defineDoc({
    checkpointWhen: () => true,
    initial: () => ({ value: 'foo' }),
    kind: 'foo',
    scope: 'session',
    version: 1,
  });
  const conversationDoc = defineDoc({
    checkpointWhen: () => true,
    fork: 'current',
    history: 'latest',
    initial: () => ({ value: 'foo' }),
    kind: 'bar',
    scope: 'conversation',
    version: 1,
  });
  const taskDoc = defineDoc({
    checkpointWhen: () => true,
    initial: () => ({ value: 'foo' }),
    kind: 'baz',
    scope: 'task',
    version: 1,
  });
  const task = defineTask<null, { phase: 'foo' }, null>({
    abort: async () => undefined,
    initial: () => ({ phase: 'foo' }),
    name: 'foo',
    phases: { foo: async () => undefined },
    version: 1,
  });
  const records = await session.commit(async (tx) => {
    const keep = await tx.createConversation({
      ownership: { kind: 'ownerless' },
    });
    const drop = await tx.createConversation({
      ownership: { kind: 'ownerless' },
    });
    const keptTask = await tx.createTask(task, null, {
      conversationId: keep.id,
      ownership: { kind: 'conversation' },
    });
    const removedTask = await tx.createTask(task, null, {
      conversationId: drop.id,
      ownership: { kind: 'conversation' },
    });
    const child = await tx.createConversation({
      ownership: { kind: 'task', taskId: removedTask },
    });
    const nested = await tx.createTask(task, null, {
      conversationId: child.id,
      ownership: { kind: 'conversation' },
    });
    const grandchild = await tx.createConversation({
      ownership: { kind: 'task', taskId: nested },
    });

    (await tx.doc(sessionDoc)).value = 'bar';
    (await tx.doc(conversationDoc, keep.id)).value = 'baz';
    (await tx.doc(conversationDoc, drop.id)).value = 'qux';
    (await tx.doc(taskDoc, keptTask)).value = 'quux';
    (await tx.doc(taskDoc, removedTask)).value = 'quuz';

    return { child, drop, grandchild, keep, keptTask, removedTask };
  }, BACKGROUND_CONTEXT);

  await session.close(BACKGROUND_CONTEXT);

  expect(await purgeConversations(path, [records.drop.id])).toEqual([
    records.drop.id,
    records.child.id,
    records.grandchild.id,
  ]);

  const reopened = createSession(await openNodeSqliteStorage(path));
  const conversations = await reopened.commit(
    (tx) => tx.scanConversations({}, 10),
    BACKGROUND_CONTEXT
  );
  const tasks = await reopened.commit(
    (tx) => tx.scanTasks({}, 10),
    BACKGROUND_CONTEXT
  );

  expect({
    conversations: conversations.items,
    documents: await Promise.all([
      reopened.snapshot(sessionDoc, BACKGROUND_CONTEXT),
      reopened.snapshot(conversationDoc, records.keep.id, BACKGROUND_CONTEXT),
      reopened.snapshot(conversationDoc, records.drop.id, BACKGROUND_CONTEXT),
      reopened.snapshot(taskDoc, records.keptTask, BACKGROUND_CONTEXT),
      reopened.snapshot(taskDoc, records.removedTask, BACKGROUND_CONTEXT),
    ]),
    tasks: tasks.items.map(({ id }) => id),
  }).toEqual({
    conversations: [records.keep],
    documents: [
      { value: 'bar' },
      { value: 'baz' },
      undefined,
      { value: 'quux' },
      undefined,
    ],
    tasks: [records.keptTask],
  });

  await reopened.close(BACKGROUND_CONTEXT);
});
