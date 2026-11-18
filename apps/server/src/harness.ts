import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { schema } from '@lab/db';
import {
  ComputerDoc,
  adoptGlobalDocs,
  openHarness,
  purgeConversations,
} from '@lab/harness';
import { inArray, sql } from 'drizzle-orm';

import { chatsAccess } from './chat-access';
import { connectorAccess } from './connector-access';
import { db } from './db';
import { env } from './env';
import { recordHelperUsage } from './helper-usage';
import { historyAccess } from './history-access';
import { imageAccess } from './image-access';
import { libraryAccess } from './library-access';
import { models } from './models';
import { projectAccess } from './project-access';
import { requireOwner } from './records';
import { registry } from './registry';
import { createSandboxAccess } from './sandbox';
import { scheduleAccess } from './schedule-access';
import { checkSpend } from './spend';
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
  admit: async (conversationId) =>
    checkSpend(await requireOwner(conversationId)),
  history: historyAccess,
  images: imageAccess,
  library: libraryAccess,
  models,
  onHelperUsage: recordHelperUsage,
  onReport: (report) => console.error(report),
  path: env.LAB_STORAGE_PATH,
  chats: chatsAccess,
  connectors: connectorAccess,
  owner: requireOwner,
  project: projectAccess,
  registry,
  schedule: scheduleAccess,
  sandbox: createSandboxAccess(
    async (ownerId) =>
      (await harness.snapshot(ComputerDoc, ownerId, BACKGROUND_CONTEXT))
        ?.network ?? 'full'
  ),
  web: webAccess(),
});

const [admin] = await db
  .select({ id: schema.user.id })
  .from(schema.user)
  .where(sql`lower(${schema.user.email}) = lower(${env.LAB_ADMIN_EMAIL})`);

if (admin) {
  await adoptGlobalDocs(harness, admin.id, BACKGROUND_CONTEXT);
}
