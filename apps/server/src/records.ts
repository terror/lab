import { schema } from '@lab/db';
import { ilike, inArray } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

import { db } from './db';

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

  const rows = await db
    .select({
      id: schema.conversation.id,
      ownerId: schema.conversation.ownerId,
    })
    .from(schema.conversation)
    .where(inArray(schema.conversation.id, [...new Set(ids)]));

  return new Map(rows.map(({ id, ownerId }) => [id, ownerId]));
}

export function contains(column: AnyPgColumn, search: string) {
  const pattern = search.replace(/[\\%_]/g, (character) => `\\${character}`);

  return ilike(column, `%${pattern}%`);
}
