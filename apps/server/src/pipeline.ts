import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import type {
  CommitChange,
  ConversationId,
  Cursor,
  EntryRecord,
} from '@earendil-works/pi-durable';

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
  cursor?: Cursor
): Promise<void> {
  const conversation = await harness.conversation(
    id as ConversationId,
    BACKGROUND_CONTEXT
  );

  const page = await conversation?.entries(
    { order: 'ascending' },
    100,
    cursor,
    BACKGROUND_CONTEXT
  );

  if (!page) {
    return;
  }

  await visit(page.items);

  if (page.next !== undefined) {
    await eachEntry(id, visit, page.next);
  }
}
