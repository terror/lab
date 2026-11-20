import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import type {
  CommitChange,
  Conversation,
  ConversationId,
  Cursor,
  EntryRecord,
} from '@earendil-works/pi-durable';
import { schema } from '@lab/db';
import { TitleDoc } from '@lab/harness';
import { eq } from 'drizzle-orm';

import { db } from './db';
import { harness } from './harness';
import { isMessage } from './message-entry';
import { observe } from './pipeline';

type Columns = Pick<
  typeof schema.conversation.$inferInsert,
  'title' | 'lastMessageAt'
>;

const latest = new Map<number, number>();

async function latestMessage(
  conversation: Conversation,
  cursor?: Cursor
): Promise<EntryRecord | undefined> {
  const page = await conversation.entries({}, 50, cursor, BACKGROUND_CONTEXT);

  const entry = page.items.find(isMessage);

  if (entry || page.next === undefined) {
    return entry;
  }

  return latestMessage(conversation, page.next);
}

function projected(changes: readonly CommitChange[]) {
  const updates = new Map<number, Columns>();

  for (const change of changes) {
    if (
      change.type === 'document' &&
      change.kind === 'change' &&
      change.record.kind === TitleDoc.definition.kind &&
      change.conversationId !== undefined
    ) {
      const title = change.value.title;

      if (typeof title === 'string' || title === null) {
        updates.set(change.conversationId, {
          ...updates.get(change.conversationId),
          title,
        });
      }
    }

    if (change.type === 'entry' && isMessage(change.value)) {
      const { conversationId, id, model } = change.value;
      const timestamp = model?.[0]?.timestamp;

      if (timestamp !== undefined && id >= (latest.get(conversationId) ?? 0)) {
        latest.set(conversationId, id);
        updates.set(conversationId, {
          ...updates.get(conversationId),
          lastMessageAt: new Date(timestamp),
        });
      }
    }
  }

  return [...updates];
}

async function project(updates: readonly (readonly [number, Columns])[]) {
  for (const [id, values] of updates) {
    await db
      .update(schema.conversation)
      .set(values)
      .where(eq(schema.conversation.id, id));
  }
}

const observer = observe(projected, project);

export const projectionPipeline = {
  backfill: projectAll,
  flush: observer.flush,
  start: () => {
    const observation = observer.start();

    return {
      detach: () => {
        observation.detach();
        latest.clear();
      },
    };
  },
};

export const flushProjections = projectionPipeline.flush;

export async function projectAll() {
  const rows = await db
    .select({ id: schema.conversation.id })
    .from(schema.conversation);

  for (const { id } of rows) {
    const title = await harness().snapshot(
      TitleDoc,
      id as ConversationId,
      BACKGROUND_CONTEXT
    );

    const conversation = await harness().conversation(
      id as ConversationId,
      BACKGROUND_CONTEXT
    );

    const entry = conversation && (await latestMessage(conversation));
    const timestamp = entry?.model?.[0]?.timestamp;
    const values: Columns = {};

    if (title) {
      values.title = title.title;
    }

    if (entry && timestamp !== undefined) {
      latest.set(id, entry.id);
      values.lastMessageAt = new Date(timestamp);
    }

    if (Object.keys(values).length > 0) {
      await project([[id, values]]);
    }
  }
}
