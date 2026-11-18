import { schema } from '@lab/db';
import { type ArtifactStateAccess, STORE_KEY_LIMIT } from '@lab/harness';
import { and, asc, eq, sql } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';

import { db } from './db';
import { reserveStorage } from './storage';

const table = schema.artifactState;

function saved(conversationId: number, artifactId: string) {
  return and(
    eq(table.conversationId, conversationId),
    eq(table.artifactId, artifactId)
  );
}

function entry(conversationId: number, artifactId: string, key: string) {
  return and(saved(conversationId, artifactId), eq(table.key, key));
}

export const artifactStateAccess: ArtifactStateAccess = {
  read: (conversationId, artifactId) =>
    db
      .select({ key: table.key, value: table.value })
      .from(table)
      .where(saved(conversationId, artifactId))
      .orderBy(asc(table.key)),
};

export async function readValue(
  conversationId: number,
  artifactId: string,
  key: string
) {
  const [row] = await db
    .select({ value: table.value })
    .from(table)
    .where(entry(conversationId, artifactId, key));

  return row?.value ?? null;
}

export function saveValue(
  ownerId: string,
  conversationId: number,
  artifactId: string,
  { key, value }: { key: string; value: string }
) {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({
        bytes:
          sql`octet_length(${table.key}) + octet_length(${table.value})`.mapWith(
            Number
          ),
      })
      .from(table)
      .where(entry(conversationId, artifactId, key));

    if (
      !existing &&
      (await tx.$count(table, saved(conversationId, artifactId))) >=
        STORE_KEY_LIMIT
    ) {
      throw new HTTPException(400, {
        message: `An artifact can save up to ${STORE_KEY_LIMIT} keys.`,
      });
    }

    await reserveStorage(
      tx,
      ownerId,
      Buffer.byteLength(key) + Buffer.byteLength(value) - (existing?.bytes ?? 0)
    );

    await tx
      .insert(table)
      .values({ artifactId, conversationId, key, ownerId, value })
      .onConflictDoUpdate({
        set: { value },
        target: [table.conversationId, table.artifactId, table.key],
      });
  });
}

export async function deleteValue(
  conversationId: number,
  artifactId: string,
  key: string
) {
  await db.delete(table).where(entry(conversationId, artifactId, key));
}
