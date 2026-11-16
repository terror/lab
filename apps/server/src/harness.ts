import { schema } from '@lab/db';
import { openHarness, purgeConversations } from '@lab/harness';
import { inArray } from 'drizzle-orm';

import { db } from './db';
import { env } from './env';
import { recordHelperUsage } from './helper-usage';
import { models } from './models';

export async function purgeDeleted(path: string) {
  const deleted = await db
    .select({ id: schema.conversationDeletion.id })
    .from(schema.conversationDeletion);

  const purged = purgeConversations(
    path,
    deleted.map(({ id }) => id)
  );

  if (purged.length > 0) {
    await db
      .delete(schema.conversationDeletion)
      .where(inArray(schema.conversationDeletion.id, purged));
  }

  return purged;
}

await purgeDeleted(env.LAB_STORAGE_PATH);

export const harness = await openHarness({
  models,
  onHelperUsage: recordHelperUsage,
  onReport: (report) => console.error(report),
  path: env.LAB_STORAGE_PATH,
});
