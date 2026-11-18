import type { ExtensionDeps } from '@lab/harness';

import { harnessDeps } from '../src/harness';

export function emptyDeps(): ExtensionDeps {
  return {
    ...harnessDeps(),
    admit: async () => undefined,
    history: { read: async () => undefined, search: async () => [] },
    images: {
      available: async () => false,
      generate: async () => {
        throw new Error('Image generation is unavailable in tests.');
      },
    },
    library: { read: async () => undefined, search: async () => [] },
    onHelperUsage: () => undefined,
    web: {
      available: async () => false,
      fetch: async () => {
        throw new Error('Web search is unavailable in tests.');
      },
      search: async () => [],
    },
  };
}
