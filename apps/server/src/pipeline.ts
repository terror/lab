import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import type {
  CommitChange,
  ConversationId,
  Cursor,
  EntryRecord,
} from '@earendil-works/pi-durable';
import { schema } from '@lab/db';
import { and, eq } from 'drizzle-orm';

import { db } from './db';
import { harness } from './harness';
import { serial } from './records';

export function observe<T>(
  select: (changes: readonly CommitChange[]) => readonly T[],
  handle: (items: readonly T[]) => Promise<void>,
  queue = serial()
) {
  harness.observeCommits({
    advance: ({ changes }) => {
      const items = select(changes);

      if (items.length > 0) {
        queue.run(() => handle(items));
      }
    },
    end: () => undefined,
  });

  return queue.flush;
}

export function entryChanges(
  changes: readonly CommitChange[],
  keep: (entry: EntryRecord) => boolean
) {
  return changes.flatMap((change) =>
    change.type === 'entry' && keep(change.value) ? [change.value] : []
  );
}

export async function eachEntry(
  id: number,
  visit: (entries: readonly EntryRecord[]) => Promise<void>,
  after?: number,
  cursor?: Cursor
): Promise<void> {
  const conversation = await harness.conversation(
    id as ConversationId,
    BACKGROUND_CONTEXT
  );

  const page = await conversation?.entries(
    {
      minEntryId:
        after === undefined ? undefined : ((after + 1) as EntryRecord['id']),
      order: 'ascending',
    },
    100,
    cursor,
    BACKGROUND_CONTEXT
  );

  if (!page) {
    return;
  }

  await visit(page.items);

  if (page.next !== undefined) {
    await eachEntry(id, visit, after, page.next);
  }
}

export async function backfill(
  pipeline: string,
  id: number,
  visit: (entries: readonly EntryRecord[]) => Promise<void>
) {
  const table = schema.backfillCheckpoint;

  const [checkpoint] = await db
    .select({ entryId: table.entryId })
    .from(table)
    .where(and(eq(table.pipeline, pipeline), eq(table.conversationId, id)));

  await eachEntry(
    id,
    async (entries) => {
      await visit(entries);

      const last = entries.at(-1);

      if (last) {
        await db
          .insert(table)
          .values({ conversationId: id, entryId: last.id, pipeline })
          .onConflictDoUpdate({
            set: { entryId: last.id },
            target: [table.pipeline, table.conversationId],
          });
      }
    },
    checkpoint?.entryId
  );
}
