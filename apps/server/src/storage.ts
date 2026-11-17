import { schema } from '@lab/db';
import { eq, sql } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';

import { db } from './db';
import { policy } from './policy';

const MEGABYTE = 1_000_000;

const table = schema.upload;

export async function storeUpload(
  ownerId: string,
  {
    content,
    mimeType,
    thumbnail = null,
  }: { content: Uint8Array; mimeType: string; thumbnail?: Uint8Array | null }
) {
  const { storageLimit } = await policy(ownerId);

  return db.transaction(async (tx) => {
    if (storageLimit !== undefined) {
      await tx.execute(
        sql`select 1 from ${schema.user} where ${schema.user.id} = ${ownerId} for update`
      );

      const [usage] = await tx
        .select({
          used: sql`coalesce(sum(octet_length(${table.content}) + coalesce(octet_length(${table.thumbnail}), 0)), 0)`.mapWith(
            Number
          ),
        })
        .from(table)
        .where(eq(table.ownerId, ownerId));

      const adding = content.byteLength + (thumbnail?.byteLength ?? 0);

      if ((usage?.used ?? 0) + adding > storageLimit * MEGABYTE) {
        throw new HTTPException(413, {
          message: `You’ve used your ${storageLimit} MB of storage. Delete files from your library to add more.`,
        });
      }
    }

    const [created] = await tx
      .insert(table)
      .values({ content, mimeType, ownerId, thumbnail })
      .returning({ id: table.id });

    if (!created) {
      throw new Error('Unable to save the file');
    }

    return created.id;
  });
}
