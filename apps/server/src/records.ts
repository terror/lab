import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import type {
  ConversationRecord,
  Cursor,
  Harness,
} from '@earendil-works/pi-durable';
import { schema } from '@lab/db';
import { and, eq, ilike, inArray, isNotNull, isNull } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

import { db } from './db';
import { storable } from './text';

export function serial() {
  let pending = Promise.resolve();

  return {
    flush: () => pending,
    run: (task: () => Promise<void>) => {
      pending = pending.then(() => task().catch(console.error));
    },
  };
}

export async function owners(ids: readonly number[]) {
  if (ids.length === 0) {
    return new Map<number, string>();
  }

  const unique = [...new Set(ids)];

  const [live, deleted] = await Promise.all([
    db
      .select({
        id: schema.conversation.id,
        ownerId: schema.conversation.ownerId,
      })
      .from(schema.conversation)
      .where(inArray(schema.conversation.id, unique)),
    db
      .select({
        id: schema.conversationDeletion.id,
        ownerId: schema.conversationDeletion.ownerId,
      })
      .from(schema.conversationDeletion)
      .where(
        and(
          inArray(schema.conversationDeletion.id, unique),
          isNotNull(schema.conversationDeletion.ownerId)
        )
      ),
  ]);

  return new Map(
    [...deleted, ...live].flatMap(({ id, ownerId }) =>
      ownerId === null ? [] : [[id, ownerId] as const]
    )
  );
}

export function liveChat(ownerId: string, id: number) {
  return and(
    eq(schema.conversation.id, id),
    eq(schema.conversation.ownerId, ownerId),
    isNull(schema.conversation.deletedAt)
  );
}

export function contains(column: AnyPgColumn, search: string) {
  const pattern = storable(search).replace(
    /[\\%_]/g,
    (character) => `\\${character}`
  );

  return ilike(column, `%${pattern}%`);
}

type Chat = { id: number; ownerId: string };

const parents = new Map<number, number>();

const knownChats = new Map<number, Promise<Chat>>();

export async function trackOwners(harness: Harness) {
  const remember = (record: ConversationRecord) => {
    if (record.owner) {
      parents.set(record.id, record.owner.conversationId);
    }
  };

  const observation = harness.observeCommits({
    advance: ({ changes }) => {
      for (const change of changes) {
        if (change.type === 'conversation') {
          remember(change.value);
        }
      }
    },
    end: () => undefined,
  });

  const detach = () => {
    observation.detach();
    parents.clear();
    knownChats.clear();
  };

  const read = async (cursor?: Cursor): Promise<void> => {
    const page = await harness.commit(
      (tx) => tx.scanConversations({}, 100, cursor),
      BACKGROUND_CONTEXT
    );

    page.items.forEach(remember);

    if (page.next !== undefined) {
      await read(page.next);
    }
  };

  try {
    await read();
    return detach;
  } catch (error) {
    detach();
    throw error;
  }
}

export async function chatOf(
  conversationId: number
): Promise<Chat | undefined> {
  const ownerId = (await owners([conversationId])).get(conversationId);

  if (ownerId) {
    return { id: conversationId, ownerId };
  }

  const parent = parents.get(conversationId);

  return parent === undefined ? undefined : chatOf(parent);
}

export async function conversationOwner(conversationId: number) {
  return (await chatOf(conversationId))?.ownerId;
}

async function lookupChat(conversationId: number) {
  const chat = await chatOf(conversationId);

  if (!chat) {
    throw new Error('This chat has no owner.');
  }

  return chat;
}

export function requireChat(conversationId: number) {
  const known = knownChats.get(conversationId) ?? lookupChat(conversationId);

  knownChats.set(conversationId, known);

  known.catch(() => knownChats.delete(conversationId));

  return known;
}

export async function requireOwner(conversationId: number) {
  return (await requireChat(conversationId)).ownerId;
}
