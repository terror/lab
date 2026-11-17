import { schema } from '@lab/db';
import { eq, sql } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';

import { isAdmin } from './auth';
import { db } from './db';
import { env } from './env';

const MEGABYTE = 1_000_000;

export async function checkStorage(ownerId: string, adding: number) {
  const limit = env.LAB_STORAGE_LIMIT;

  if (limit === undefined) {
    return;
  }

  const [owner] = await db
    .select({ email: schema.user.email })
    .from(schema.user)
    .where(eq(schema.user.id, ownerId));

  if (!owner || isAdmin(owner)) {
    return;
  }

  const [usage] = await db
    .select({
      used: sql`coalesce(sum(octet_length(${schema.upload.content}) + coalesce(octet_length(${schema.upload.thumbnail}), 0)), 0)`.mapWith(
        Number
      ),
    })
    .from(schema.upload)
    .where(eq(schema.upload.ownerId, ownerId));

  if ((usage?.used ?? 0) + adding > limit * MEGABYTE) {
    throw new HTTPException(413, {
      message: `You’ve used your ${limit} MB of storage. Delete files from your library to add more.`,
    });
  }
}
