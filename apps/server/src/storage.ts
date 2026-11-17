import { schema } from '@lab/db';
import {
  and,
  eq,
  isNotNull,
  isNull,
  lt,
  ne,
  notInArray,
  sql,
} from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';

import { db } from './db';
import { policy } from './policy';

const MEGABYTE = 1_000_000;

const table = schema.upload;

const library = schema.libraryItem;

type Reader = Pick<typeof db, 'select'>;

async function usedBytes(reader: Reader, ownerId: string) {
  const [uploads, items] = await Promise.all([
    reader
      .select({
        bytes:
          sql`coalesce(sum(octet_length(${table.content}) + coalesce(octet_length(${table.thumbnail}), 0)), 0)`.mapWith(
            Number
          ),
      })
      .from(table)
      .where(eq(table.ownerId, ownerId)),
    reader
      .select({
        bytes: sql`coalesce(sum(octet_length(${library.content})), 0)`.mapWith(
          Number
        ),
      })
      .from(library)
      .where(and(eq(library.ownerId, ownerId), isNull(library.uploadId))),
  ]);

  return (uploads[0]?.bytes ?? 0) + (items[0]?.bytes ?? 0);
}

function full(limit: number) {
  return new HTTPException(413, {
    message: `You’ve used your ${limit} MB of storage. Delete chats with files and empty the Trash to free up space.`,
  });
}

export async function checkStorage(ownerId: string, adding: number) {
  const { storageLimit } = await policy(ownerId);

  if (
    storageLimit !== undefined &&
    adding > 0 &&
    (await usedBytes(db, ownerId)) + adding > storageLimit * MEGABYTE
  ) {
    throw full(storageLimit);
  }
}

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

      const adding = content.byteLength + (thumbnail?.byteLength ?? 0);

      if ((await usedBytes(tx, ownerId)) + adding > storageLimit * MEGABYTE) {
        throw full(storageLimit);
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

export async function pruneUploads(ownerId: string) {
  const [owner] = await db
    .select({ image: schema.user.image })
    .from(schema.user)
    .where(eq(schema.user.id, ownerId));

  const picture = owner?.image?.replace(/^\/api\/uploads\//, '');

  await db.delete(table).where(
    and(
      eq(table.ownerId, ownerId),
      lt(table.createdAt, sql`now() - interval '1 day'`),
      notInArray(
        table.id,
        db
          .select({ id: sql`${library.uploadId}` })
          .from(library)
          .where(isNotNull(library.uploadId))
      ),
      picture ? ne(sql`${table.id}::text`, picture) : undefined
    )
  );
}
