import type { ExtensionDeps } from '@lab/harness';

import { createSandboxAccess } from '../src/sandbox';

export function emptyDeps(): ExtensionDeps {
  return {
    history: { read: async () => undefined, search: async () => [] },
    library: { read: async () => undefined, search: async () => [] },
    onHelperUsage: () => undefined,
    sandbox: createSandboxAccess(async () => 'full'),
    web: {
      available: async () => false,
      fetch: async () => {
        throw new Error('Web search is unavailable in tests.');
      },
      mentioned: async () => false,
      search: async () => [],
    },
  };
}
