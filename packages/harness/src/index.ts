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

import { extensions } from './extensions';
import type { HelperUsage } from './helper';

export { TitleDoc } from './extensions';
export { type HelperUsage, helperModel } from './helper';
export { purgeConversations } from './purge';

export type HarnessOptions = {
  models: Models;
  onHelperUsage: HelperUsage;
  onReport?: (report: Report) => void;
  path: string;
};

export async function openHarness(
  { path, models, onHelperUsage, onReport }: HarnessOptions,
  context: Context = BACKGROUND_CONTEXT
): Promise<Harness> {
  const registry = createRegistry();

  for (const extension of extensions(onHelperUsage)) {
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
