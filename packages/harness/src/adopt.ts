import type { Context } from '@earendil-works/chord/context';
import {
  type Harness,
  type JsonObject,
  type SessionDocFamilyToken,
  defineDoc,
} from '@earendil-works/pi-durable';

import {
  ComputerDoc,
  MemoryDoc,
  PreferencesDoc,
  ProfileDoc,
  SkillsDoc,
} from './extensions';

function legacy(kind: string) {
  return defineDoc<JsonObject>({
    checkpointWhen: () => true,
    initial: () => ({}),
    kind,
    scope: 'session',
    version: 1,
  });
}

async function adopt<T extends JsonObject>(
  harness: Harness,
  kind: string,
  doc: SessionDocFamilyToken<T, null>,
  ownerId: string,
  context: Context
) {
  const value = await harness.snapshot(legacy(kind), context);

  if (!value || (await harness.snapshot(doc, ownerId, context))) {
    return;
  }

  await harness.commit(async (tx) => {
    Object.assign(await tx.doc(doc, ownerId, null), structuredClone(value));
  }, context);
}

export async function adoptGlobalDocs(
  harness: Harness,
  ownerId: string,
  context: Context
) {
  await adopt(harness, 'lab.computer', ComputerDoc, ownerId, context);
  await adopt(harness, 'lab.memory', MemoryDoc, ownerId, context);
  await adopt(harness, 'lab.preferences', PreferencesDoc, ownerId, context);
  await adopt(harness, 'lab.profile', ProfileDoc, ownerId, context);
  await adopt(harness, 'lab.skills', SkillsDoc, ownerId, context);
}
