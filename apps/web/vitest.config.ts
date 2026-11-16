import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
import { fileURLToPath } from 'node:url';
import { defineConfig, mergeConfig } from 'vitest/config';

import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig({ command: 'serve', mode: 'test' }),
  defineConfig({
    plugins: [
      storybookTest({
        configDir: fileURLToPath(new URL('.storybook', import.meta.url)),
      }),
    ],
    test: {
      browser: {
        enabled: true,
        headless: true,
        instances: [{ browser: 'chromium' }],
        provider: playwright(),
      },
      name: 'storybook',
    },
  })
);
