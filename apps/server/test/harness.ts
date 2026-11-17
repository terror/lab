import type { ExtensionDeps } from '@lab/harness';

import { projectAccess } from '../src/project-access';
import { createSandboxAccess } from '../src/sandbox';
import { scheduleAccess } from '../src/schedule-access';

export function emptyDeps(): ExtensionDeps {
  return {
    history: { read: async () => undefined, search: async () => [] },
    library: { read: async () => undefined, search: async () => [] },
    onHelperUsage: () => undefined,
    sandbox: createSandboxAccess(async () => 'full'),
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
