import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import type {
  CommitChange,
  ConversationId,
  Cursor,
  EntryRecord,
} from '@earendil-works/pi-durable';
import { schema } from '@lab/db';
import * as Sentry from '@sentry/bun';
import { and, eq } from 'drizzle-orm';

import { db } from './db';
import { harness } from './harness';
import { owners, serial } from './records';

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

async function subagentsOf(id: number, cursor?: Cursor): Promise<number[]> {
  const page = await harness.commit(
    (tx) =>
      tx.scanConversations(
        { ownerConversationId: id as ConversationId },
        100,
        cursor
      ),
    BACKGROUND_CONTEXT
  );

  const owned = page.items.map((record) => record.id);

  const nested = await Promise.all(owned.map((child) => subagentsOf(child)));

  const rest = page.next === undefined ? [] : await subagentsOf(id, page.next);

  return [...owned, ...nested.flat(), ...rest];
}

export async function backfill(
  pipeline: string,
  id: number,
  visit: (entries: readonly EntryRecord[]) => Promise<void>,
  conversation = id
) {
  const table = schema.backfillCheckpoint;

  const [checkpoint] = await db
    .select({ entryId: table.entryId })
    .from(table)
    .where(and(eq(table.pipeline, pipeline), eq(table.conversationId, id)));

  await eachEntry(
    conversation,
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

type Keyed = { conversationId: number; entryId: number };

function skip(pipeline: string, row: Keyed, error: unknown) {
  console.error(
    `Skipped entry ${row.entryId} of conversation ${row.conversationId} in the ${pipeline} backfill`,
    error
  );

  Sentry.captureException(error, { extra: { ...row, pipeline } });
}

export function entryPipeline<Row extends Keyed>({
  keep,
  name,
  rows,
  store,
  subagents = false,
}: {
  keep: (entry: EntryRecord) => boolean;
  name: string;
  rows: (
    entries: readonly EntryRecord[],
    owned: ReadonlyMap<number, string>
  ) => Row[] | Promise<Row[]>;
  store: (rows: Row[]) => Promise<unknown>;
  subagents?: boolean;
}) {
  const build = async (entries: readonly EntryRecord[]) => {
    const owned = await owners(
      entries.map(({ conversationId }) => conversationId)
    );

    return rows(entries, owned);
  };

  const record = async (entries: readonly EntryRecord[]) => {
    const built = await build(entries);

    if (built.length > 0) {
      await store(built);
    }
  };

  const visit = async (page: readonly EntryRecord[]) => {
    const built = await build(page.filter(keep));

    if (built.length === 0) {
      return;
    }

    const stored = await store(built).then(
      () => true,
      () => false
    );

    if (stored) {
      return;
    }

    for (const row of built) {
      await store([row]).catch((error: unknown) => skip(name, row, error));
    }
  };

  return {
    backfill: async () => {
      const conversations = await db
        .select({ id: schema.conversation.id })
        .from(schema.conversation);

      for (const { id } of conversations) {
        await backfill(name, id, visit);

        if (subagents) {
          for (const subagent of await subagentsOf(id)) {
            await backfill(`${name}/${subagent}`, id, visit, subagent);
          }
        }
      }
    },
    flush: observe((changes) => entryChanges(changes, keep), record),
  };
}
