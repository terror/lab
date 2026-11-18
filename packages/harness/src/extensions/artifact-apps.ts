import {
  type ConversationId,
  type ToolExecutionResult,
  defineExtension,
  defineTool,
  section,
} from '@earendil-works/pi-durable';
import { obj } from '@earendil-works/pi-schema';

import { ArtifactsDoc, artifactId } from './artifacts';
import { failure, text } from './results';

export const STORE_KEY_LENGTH = 100;

export const STORE_KEY_LIMIT = 100;

export const STORE_VALUE_LENGTH = 100_000;

type ArtifactValue = { key: string; value: string };

export type ArtifactStateAccess = {
  read(
    conversationId: ConversationId,
    artifactId: string
  ): Promise<ArtifactValue[]>;
};

function listing(title: string, id: string, values: readonly ArtifactValue[]) {
  if (values.length === 0) {
    return `"${title}" (${id}) has nothing saved.`;
  }

  return [
    `"${title}" (${id}) saved:`,
    '',
    ...values.map(({ key, value }) => `${key}: ${value}`),
  ].join('\n');
}

export function artifactApps(access: ArtifactStateAccess) {
  const stateRead = defineTool({
    name: 'artifact_state_read',
    description:
      'Read the values an artifact in this chat saved with lab.store, for example to see what the user tracked in it.',
    parameters: obj({ id: artifactId }),
    execute: async ({ id }, api, context): Promise<ToolExecutionResult> => {
      const doc = await api.snapshot(ArtifactsDoc, api.conversationId, context);

      const artifact = doc?.artifacts[id];

      if (!artifact) {
        return failure(`No artifact has the id "${id}".`);
      }

      const values = await access.read(api.conversationId, id);

      return {
        details: { id, keys: values.length, title: artifact.title },
        output: text(listing(artifact.title, id, values)),
      };
    },
  });

  return defineExtension({
    name: 'lab.artifact-apps',
    sections: [
      section(
        'artifact_apps',
        () =>
          `Artifacts can save data on the server that survives reloads; use it instead of localStorage, which artifacts cannot use. await lab.store.get(key) returns a saved JSON value or null, await lab.store.set(key, value) saves one, and await lab.store.delete(key) removes one, with up to ${STORE_KEY_LIMIT} keys of up to ${STORE_VALUE_LENGTH.toLocaleString('en-US')} characters each per artifact. Use artifact_state_read to see what an artifact saved, for example to answer questions about what the user tracked in it.`
      ),
    ],
    tools: [stateRead],
  });
}
