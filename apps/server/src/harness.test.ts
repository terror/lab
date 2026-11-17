import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import type { ConversationId } from '@earendil-works/pi-durable';
import { schema } from '@lab/db';
import { openHarness, purgeConversations } from '@lab/harness';
import { expect, test } from 'bun:test';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { db } from './db';
import { purgeDeleted } from './harness';
import { models } from './models';
import { sandboxAccess } from './sandbox';

const queries = [
  'select id from conversations order by id',
  'select distinct conversation_id as id from entries order by id',
  'select distinct conversation_id as id from tasks order by id',
  'select distinct conversation_id as id from submissions order by id',
];

function stored(path: string) {
  const database = new DatabaseSync(path);

  try {
    return queries.map((query) =>
      database
        .prepare(query)
        .all()
        .map(({ id }) => Number(id))
    );
  } finally {
    database.close();
  }
}

async function converse(harness: Awaited<ReturnType<typeof openHarness>>) {
  const conversation = await harness.createConversation(
    { ownership: { kind: 'ownerless' } },
    BACKGROUND_CONTEXT
  );

  await conversation.submit(
    { content: 'foo', type: 'input', whenBusy: 'followUp' },
    BACKGROUND_CONTEXT
  );

  await conversation.waitForIdle(BACKGROUND_CONTEXT);

  return conversation.id;
}

test('deleted conversations are purged from storage', async () => {
  const path = join(await mkdtemp(join(tmpdir(), 'lab-')), 'lab.sqlite');

  const first = await openHarness({
    models,
    history: { read: async () => undefined, search: async () => [] },
    library: { read: async () => undefined, search: async () => [] },
    sandbox: sandboxAccess,
    web: {
      available: async () => false,
      fetch: async () => {
        throw new Error('foo');
      },
      mentioned: async () => false,
      search: async () => [],
    },
    onHelperUsage: () => undefined,
    path,
  });

  const keep = await converse(first);
  const drop = await converse(first);

  await first.close(BACKGROUND_CONTEXT);

  await db.delete(schema.conversationDeletion);

  await db.insert(schema.conversationDeletion).values({ id: drop });

  expect(await purgeDeleted(path)).toEqual([drop]);

  expect(stored(path)).toEqual([[keep], [keep], [keep], [keep]]);

  const second = await openHarness({
    models,
    history: { read: async () => undefined, search: async () => [] },
    library: { read: async () => undefined, search: async () => [] },
    sandbox: sandboxAccess,
    web: {
      available: async () => false,
      fetch: async () => {
        throw new Error('foo');
      },
      mentioned: async () => false,
      search: async () => [],
    },
    onHelperUsage: () => undefined,
    path,
  });

  expect([
    (await second.conversation(keep, BACKGROUND_CONTEXT))?.id,
    await second.conversation(drop, BACKGROUND_CONTEXT),
  ]).toEqual([keep, undefined]);

  await second.close(BACKGROUND_CONTEXT);
});

test('fork parents and missing stores are handled by the purge', async () => {
  const path = join(await mkdtemp(join(tmpdir(), 'lab-')), 'lab.sqlite');

  const harness = await openHarness({
    models,
    history: { read: async () => undefined, search: async () => [] },
    library: { read: async () => undefined, search: async () => [] },
    sandbox: sandboxAccess,
    web: {
      available: async () => false,
      fetch: async () => {
        throw new Error('foo');
      },
      mentioned: async () => false,
      search: async () => [],
    },
    onHelperUsage: () => undefined,
    path,
  });

  const root = await converse(harness);

  const fork = async (parent: number) => {
    const conversation = await harness.conversation(
      parent as ConversationId,
      BACKGROUND_CONTEXT
    );

    const { items } = await conversation!.entries(
      { order: 'descending' },
      1,
      undefined,
      BACKGROUND_CONTEXT
    );

    const record = await conversation!.commit(
      (tx) =>
        tx.forkConversation(parent as ConversationId, items[0]!.id, {
          ownership: { kind: 'ownerless' },
        }),
      BACKGROUND_CONTEXT
    );

    return record.id;
  };

  const child = await fork(root);
  const grandchild = await fork(child);

  await harness.close(BACKGROUND_CONTEXT);

  expect([
    purgeConversations(path, [root, child]),
    stored(path)[0],
    purgeConversations(join(tmpdir(), 'missing', 'lab.sqlite'), [root]),
  ]).toEqual([[], [root, child, grandchild], [root]]);
});
