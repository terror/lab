import {
  BACKGROUND_CONTEXT,
  type Context,
} from '@earendil-works/chord/context';
import type { Models } from '@earendil-works/pi-ai';
import {
  Harness,
  type ModelRef,
  type Report,
  configure,
  createRegistry,
} from '@earendil-works/pi-durable';
import { openNodeSqliteStorage } from '@earendil-works/pi-durable/storage/sqlite/node';

import { type Titles, extensions } from './extensions';

export { TitleDoc, type Titles } from './extensions';

export type HarnessOptions = {
  model: ModelRef;
  models: Models;
  onReport?: (report: Report) => void;
  path: string;
  titles: Titles;
};

export async function openHarness(
  { path, models, model, onReport, titles }: HarnessOptions,
  context: Context = BACKGROUND_CONTEXT
): Promise<Harness> {
  const registry = createRegistry();

  for (const extension of extensions(titles)) {
    registry.install(extension);
  }

  const storage = await openNodeSqliteStorage(path);

  try {
    const harness = await Harness.open(
      storage,
      {
        conversationCreated: async (tx, conversation) => {
          if (!conversation.parent && !conversation.owner) {
            await configure(tx, conversation.id, { model });
          }
        },
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
