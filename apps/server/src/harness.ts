import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import type { ConversationId } from '@earendil-works/pi-durable';
import { schema } from '@lab/db';
import { ComputerDoc, openHarness, purgeConversations } from '@lab/harness';
import { inArray } from 'drizzle-orm';

import { db } from './db';
import { env } from './env';
import { recordHelperUsage } from './helper-usage';
import { historyAccess } from './history-access';
import { libraryAccess } from './library-access';
import { models } from './models';
import { createSandboxAccess } from './sandbox';
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

const RECENT_MESSAGES = 200;

await purgeDeleted(env.LAB_STORAGE_PATH);

export const harness = await openHarness({
  history: historyAccess,
  library: libraryAccess,
  models,
  onHelperUsage: recordHelperUsage,
  onReport: (report) => console.error(report),
  path: env.LAB_STORAGE_PATH,
  sandbox: createSandboxAccess(
    async () =>
      (await harness.snapshot(ComputerDoc, BACKGROUND_CONTEXT))?.network ??
      'full'
  ),
  web: webAccess(async (id) => {
    const conversation = await harness.conversation(
      id as ConversationId,
      BACKGROUND_CONTEXT
    );

    const page = await conversation?.entries(
      { order: 'descending' },
      RECENT_MESSAGES,
      undefined,
      BACKGROUND_CONTEXT
    );

    return page?.items ?? [];
  }),
});
