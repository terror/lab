import type { ExtensionDeps } from '@lab/harness';

import { chatsAccess } from '../src/chat-access';
import { projectAccess } from '../src/project-access';
import { requireOwner } from '../src/records';
import { createSandboxAccess } from '../src/sandbox';
import { scheduleAccess } from '../src/schedule-access';

export function emptyDeps(): ExtensionDeps {
  return {
    history: { read: async () => undefined, search: async () => [] },
    library: { read: async () => undefined, search: async () => [] },
    onHelperUsage: () => undefined,
    sandbox: createSandboxAccess(async () => 'full'),
    chats: chatsAccess,
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
