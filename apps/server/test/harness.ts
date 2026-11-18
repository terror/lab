import type { ExtensionDeps } from '@lab/harness';

import { artifactStateAccess } from '../src/artifact-state';
import { chatsAccess } from '../src/chat-access';
import { connectorAccess } from '../src/connector-access';
import { projectAccess } from '../src/project-access';
import { requireOwner } from '../src/records';
import { createSandboxAccess } from '../src/sandbox';
import { scheduleAccess } from '../src/schedule-access';

export function emptyDeps(): ExtensionDeps {
  return {
    admit: async () => undefined,
    artifactState: artifactStateAccess,
    history: { read: async () => undefined, search: async () => [] },
    images: {
      available: async () => false,
      generate: async () => {
        throw new Error('Image generation is unavailable in tests.');
      },
    },
    library: { read: async () => undefined, search: async () => [] },
    onHelperUsage: () => undefined,
    sandbox: createSandboxAccess(async () => 'full'),
    chats: chatsAccess,
    connectors: connectorAccess,
    owner: requireOwner,
    project: projectAccess,
    schedule: scheduleAccess,
    web: {
      available: async () => false,
      fetch: async () => {
        throw new Error('Web search is unavailable in tests.');
      },
      search: async () => [],
    },
  };
}
