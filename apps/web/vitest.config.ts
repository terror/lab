import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
import { fileURLToPath } from 'node:url';
import { defineConfig, mergeConfig } from 'vitest/config';

import viteConfig from './vite.config';

function browser() {
  return {
    enabled: true,
    headless: true,
    instances: [{ browser: 'chromium' as const }],
    provider: playwright(),
  };
}

export default mergeConfig(
  viteConfig({ command: 'serve', mode: 'test' }),
  defineConfig({
    test: {
      projects: [
        {
          extends: true,
          plugins: [
            storybookTest({
              configDir: fileURLToPath(new URL('.storybook', import.meta.url)),
            }),
          ],
          test: { browser: browser(), name: 'storybook' },
        },
        {
          extends: true,
          test: {
            browser: browser(),
            include: ['src/**/*.test.{ts,tsx}'],
            name: 'unit',
          },
        },
      ],
    },
  })
);
