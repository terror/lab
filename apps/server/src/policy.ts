import { schema } from '@lab/db';
import { eq } from 'drizzle-orm';

import { publicFetch } from './addresses';
import { isAdmin } from './auth';
import { db } from './db';
import { env } from './env';

export async function policy(ownerId: string) {
  const [owner] = await db
    .select({ email: schema.user.email })
    .from(schema.user)
    .where(eq(schema.user.id, ownerId));

  const admin = owner !== undefined && isAdmin(owner);

  return {
    computer: admin || env.LAB_COMPUTER_USERS === 'everyone',
    fetch: admin ? fetch : publicFetch,
    privateNetwork: admin,
    spendLimit: admin ? undefined : env.LAB_MONTHLY_LIMIT,
    storageLimit: admin ? undefined : env.LAB_STORAGE_LIMIT,
  };
}
