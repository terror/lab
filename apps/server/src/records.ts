import { schema } from '@lab/db';
import { and, ilike, inArray, isNotNull } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

import { db } from './db';

export function serial() {
  let pending = Promise.resolve();

  const flush = async (): Promise<void> => {
    const current = pending;

    await current;

    if (current !== pending) {
      await flush();
    }
  };

  return {
    flush,
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

export function contains(column: AnyPgColumn, search: string) {
  const pattern = search.replace(/[\\%_]/g, (character) => `\\${character}`);

  return ilike(column, `%${pattern}%`);
}

export async function conversationOwner(conversationId: number) {
  return (await owners([conversationId])).get(conversationId);
}

async function lookupOwner(conversationId: number) {
  const ownerId = await conversationOwner(conversationId);

  if (!ownerId) {
    throw new Error('This chat has no owner.');
  }

  return ownerId;
}

const knownOwners = new Map<number, Promise<string>>();

export function requireOwner(conversationId: number) {
  const known = knownOwners.get(conversationId) ?? lookupOwner(conversationId);

  knownOwners.set(conversationId, known);

  known.catch(() => knownOwners.delete(conversationId));

  return known;
}
