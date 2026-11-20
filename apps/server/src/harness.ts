import type { Harness } from '@earendil-works/pi-durable';
import { schema } from '@lab/db';
import { purgeConversations } from '@lab/harness';
import { inArray } from 'drizzle-orm';

import { db } from './db';

export async function purgeDeleted(path: string) {
  const deleted = await db
    .select({ id: schema.conversationDeletion.id })
    .from(schema.conversationDeletion);

  const purged = await Promise.resolve(
    purgeConversations(
      path,
      deleted.map(({ id }) => id)
    )
  );

  if (purged.length > 0) {
    await db
      .delete(schema.conversationDeletion)
      .where(inArray(schema.conversationDeletion.id, purged));
  }

  return purged;
}

let current: Harness | undefined;

export function harness(): Harness {
  if (!current) {
    throw new Error('The server runtime has not started');
  }

  return current;
}

export function installHarness(value: Harness) {
  if (current) {
    throw new Error('The server runtime is already running');
  }

  current = value;

  return () => {
    current = undefined;
  };
}
