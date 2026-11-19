import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { schema } from '@lab/db';
import {
  ComputerDoc,
  type ExtensionDeps,
  adoptGlobalDocs,
  openHarness,
  purgeConversations,
} from '@lab/harness';
import { inArray, sql } from 'drizzle-orm';

import { artifactStateAccess } from './artifact-state';
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

export let harness: Awaited<ReturnType<typeof openHarness>>;

export function harnessDeps(): ExtensionDeps {
  return {
    admit: async (conversationId) =>
      checkSpend(await requireOwner(conversationId)),
    artifactState: artifactStateAccess,
    chats: chatsAccess,
    connectors: connectorAccess,
    history: historyAccess,
    images: imageAccess,
    library: libraryAccess,
    onHelperUsage: recordHelperUsage,
    owner: requireOwner,
    project: projectAccess,
    sandbox: createSandboxAccess(
      async (ownerId) =>
        (await harness.snapshot(ComputerDoc, ownerId, BACKGROUND_CONTEXT))
          ?.network ?? 'full'
    ),
    schedule: scheduleAccess,
    web: webAccess(),
  };
}

export async function openLabHarness() {
  await purgeDeleted(env.LAB_STORAGE_PATH);

  harness = await openHarness({
    ...harnessDeps(),
    models,
    onReport: (report) => console.error(report),
    path: env.LAB_STORAGE_PATH,
    registry,
  });

  const [admin] = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(sql`lower(${schema.user.email}) = lower(${env.LAB_ADMIN_EMAIL})`);

  if (admin) {
    await adoptGlobalDocs(harness, admin.id, BACKGROUND_CONTEXT);
  }
}
