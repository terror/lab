import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { schema } from '@lab/db';
import { openHarness } from '@lab/harness';
import { expect, test } from 'bun:test';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { db } from './db';
import { purgeDeleted } from './harness';
import { fallbackModel, models } from './models';

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

  const first = await openHarness({ model: fallbackModel, models, path });

  const keep = await converse(first);
  const drop = await converse(first);

  await first.close(BACKGROUND_CONTEXT);

  await db.insert(schema.conversationDeletion).values({ id: drop });

  expect(await purgeDeleted(path)).toEqual([drop]);

  expect(stored(path)).toEqual([[keep], [keep], [keep], [keep]]);

  const second = await openHarness({ model: fallbackModel, models, path });

  expect([
    (await second.conversation(keep, BACKGROUND_CONTEXT))?.id,
    await second.conversation(drop, BACKGROUND_CONTEXT),
  ]).toEqual([keep, undefined]);

  await second.close(BACKGROUND_CONTEXT);
});
