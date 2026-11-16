import {
  BACKGROUND_CONTEXT,
  type Context,
} from '@earendil-works/chord/context';
import type { Models } from '@earendil-works/pi-ai';
import {
  Harness,
  type Report,
  createRegistry,
} from '@earendil-works/pi-durable';
import { openNodeSqliteStorage } from '@earendil-works/pi-durable/storage/sqlite/node';

import { type LibraryAccess, extensions } from './extensions';
import type { HelperUsage } from './helper';

export {
  MEMORY_LENGTH,
  MEMORY_LIMIT,
  MemoryDoc,
  READ_LENGTH,
  TitleDoc,
  library,
  memory,
  type LibraryAccess,
  type LibraryContent,
  type LibraryEntry,
} from './extensions';
export { type HelperKind, type HelperUsage, helperModel } from './helper';
export { purgeConversations } from './purge';

export type HarnessOptions = {
  library: LibraryAccess;
  models: Models;
  onHelperUsage: HelperUsage;
  onReport?: (report: Report) => void;
  path: string;
};

export async function openHarness(
  { library: access, path, models, onHelperUsage, onReport }: HarnessOptions,
  context: Context = BACKGROUND_CONTEXT
): Promise<Harness> {
  const registry = createRegistry();

  for (const extension of extensions({ library: access, onHelperUsage })) {
    registry.install(extension);
  }

  const storage = await openNodeSqliteStorage(path);

  try {
    const harness = await Harness.open(
      storage,
      {
        models,
        onReport,
        registry,
      },
      context
    );

    harness.resume();

    return harness;
  } catch (error) {
    await storage.close(BACKGROUND_CONTEXT).catch(() => {});
    throw error;
  }
}
