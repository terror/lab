import {
  BACKGROUND_CONTEXT,
  type Context,
} from '@earendil-works/chord/context';
import type { Models } from '@earendil-works/pi-ai';
import {
  Harness,
  type Registry,
  type Report,
  createRegistry,
} from '@earendil-works/pi-durable';
import { openNodeSqliteStorage } from '@earendil-works/pi-durable/storage/sqlite/node';

import { type ExtensionDeps, extensions } from './extensions';

export * from './extensions';
export {
  type HelperKind,
  type HelperUsage,
  completeHelper,
  helperModel,
} from './helper';
export { purgeConversations } from './purge';
export { createRegistry } from '@earendil-works/pi-durable';
export { createToolSearchExtension } from '@earendil-works/pi-durable/tool-search';

export type HarnessOptions = ExtensionDeps & {
  models: Models;
  onReport?: (report: Report) => void;
  path: string;
  registry?: Registry;
};

export async function openHarness(
  {
    models,
    onReport,
    path,
    registry = createRegistry(),
    ...deps
  }: HarnessOptions,
  context: Context = BACKGROUND_CONTEXT
): Promise<Harness> {
  for (const extension of extensions(deps)) {
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
