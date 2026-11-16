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

let pending = Promise.resolve();

function enqueue(id: ConversationId) {
  pending = pending.then(() => project(id).catch(console.error));
}

harness.observeCommits({
  advance: ({ changes }) => {
    const ids = new Set<ConversationId>();

    for (const change of changes) {
      for (const { source } of projections) {
        const id = source(change);

        if (id !== undefined) {
          ids.add(id);
        }
      }
    }

    for (const id of ids) {
      enqueue(id);
    }
  },
  end: () => undefined,
});

export function flushProjections() {
  return pending;
}

export async function projectAll() {
  const rows = await db
    .select({ id: schema.conversation.id })
    .from(schema.conversation);

  for (const { id } of rows) {
    enqueue(id as ConversationId);
  }

  await pending;
}
