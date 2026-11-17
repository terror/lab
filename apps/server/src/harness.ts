import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { schema } from '@lab/db';
import { ComputerDoc, openHarness, purgeConversations } from '@lab/harness';
import { inArray } from 'drizzle-orm';

import { chatsAccess } from './chat-access';
import { db } from './db';
import { env } from './env';
import { recordHelperUsage } from './helper-usage';
import { historyAccess } from './history-access';
import { libraryAccess } from './library-access';
import { models } from './models';
import { projectAccess } from './project-access';
import { createSandboxAccess } from './sandbox';
import { scheduleAccess } from './schedule-access';
import { webAccess } from './web-access';

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
  history: historyAccess,
  library: libraryAccess,
  models,
  onHelperUsage: recordHelperUsage,
  onReport: (report) => console.error(report),
  path: env.LAB_STORAGE_PATH,
  chats: chatsAccess,
  project: projectAccess,
  schedule: scheduleAccess,
  sandbox: createSandboxAccess(
    async () =>
      (await harness.snapshot(ComputerDoc, BACKGROUND_CONTEXT))?.network ??
      'full'
  ),
  web: webAccess(),
});
