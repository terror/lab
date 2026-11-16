import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import type {
  CommitChange,
  Conversation,
  ConversationDocToken,
  ConversationId,
  Cursor,
  EntryRecord,
  JsonObject,
} from '@earendil-works/pi-durable';
import { schema } from '@lab/db';
import { TitleDoc } from '@lab/harness';
import { eq } from 'drizzle-orm';

import { db } from './db';
import { harness } from './harness';
import { observe } from './pipeline';
import { serial } from './records';

type Columns = Partial<
  Omit<typeof schema.conversation.$inferInsert, 'id' | 'ownerId'>
>;

type Projection = {
  read: (id: ConversationId) => Promise<Columns>;
  source: (change: CommitChange) => ConversationId | undefined;
};

function projection<T extends JsonObject>(
  doc: ConversationDocToken<T>,
  columns: (value: T) => Columns
): Projection {
  return {
    read: async (id) => {
      const value = await harness.snapshot(doc, id, BACKGROUND_CONTEXT);

      return value ? columns(value) : {};
    },
    source: (change) =>
      change.type === 'document' && change.record.kind === doc.definition.kind
        ? change.conversationId
        : undefined,
  };
}

async function latestMessage(
  conversation: Conversation,
  cursor?: Cursor
): Promise<EntryRecord | undefined> {
  const page = await conversation.entries({}, 50, cursor, BACKGROUND_CONTEXT);

  const entry = page.items.find(({ kind }) => kind === 'lab.message');

  if (entry || page.next === undefined) {
    return entry;
  }

  return latestMessage(conversation, page.next);
}

const lastMessage: Projection = {
  read: async (id) => {
    const conversation = await harness.conversation(id, BACKGROUND_CONTEXT);

    const entry = conversation && (await latestMessage(conversation));

    const timestamp = entry?.model?.[0]?.timestamp;

    return timestamp === undefined
      ? {}
      : { lastMessageAt: new Date(timestamp) };
  },
  source: (change) =>
    change.type === 'entry' && change.value.kind === 'lab.message'
      ? change.value.conversationId
      : undefined,
};

const projections = [
  projection(TitleDoc, ({ title }) => ({ title })),
  lastMessage,
];

async function project(id: ConversationId) {
  const columns = await Promise.all(projections.map(({ read }) => read(id)));

  const values = Object.assign({}, ...columns);

  if (Object.keys(values).length === 0) {
    return;
  }

  await db
    .update(schema.conversation)
    .set(values)
    .where(eq(schema.conversation.id, id));
}

const queue = serial();

async function projectEach(ids: readonly ConversationId[]) {
  for (const id of ids) {
    await project(id);
  }
}

export const flushProjections = observe(
  (changes) => [
    ...new Set(
      changes.flatMap((change) =>
        projections.flatMap(({ source }) => {
          const id = source(change);

          return id === undefined ? [] : [id];
        })
      )
    ),
  ],
  projectEach,
  queue
);

export async function projectAll() {
  const rows = await db
    .select({ id: schema.conversation.id })
    .from(schema.conversation);

  queue.run(() => projectEach(rows.map(({ id }) => id as ConversationId)));

  await queue.flush();
}
