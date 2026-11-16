import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import type {
  ConversationDocToken,
  ConversationId,
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
  kind: string;
  read: (id: ConversationId) => Promise<Columns>;
};

function projection<T extends JsonObject>(
  doc: ConversationDocToken<T>,
  columns: (value: T) => Columns
): Projection {
  return {
    kind: doc.definition.kind,
    read: async (id) => {
      const value = await harness.snapshot(doc, id, BACKGROUND_CONTEXT);

      return value ? columns(value) : {};
    },
  };
}

const projections = [projection(TitleDoc, ({ title }) => ({ title }))];

const kinds = new Set(projections.map(({ kind }) => kind));

export async function project(id: ConversationId) {
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
      if (
        change.type === 'document' &&
        change.conversationId !== undefined &&
        kinds.has(change.record.kind)
      ) {
        ids.add(change.conversationId);
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
    await project(id as ConversationId);
  }
}
