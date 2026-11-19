import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
import { fileURLToPath } from 'node:url';
import { defaultBrowserPort, defineConfig, mergeConfig } from 'vitest/config';

import viteConfig from './vite.config';

const port = Number(process.env.VITEST_BROWSER_PORT ?? defaultBrowserPort);

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
    optimizeDeps: {
      entries: ['src/**/*.{ts,tsx}', '.storybook/*.{ts,tsx}'],
    },
    test: {
      restoreMocks: true,
      setupFiles: ['./src/test/setup.ts'],
      unstubGlobals: true,
      projects: [
        {
          extends: true,
          plugins: [
            storybookTest({
              configDir: fileURLToPath(new URL('.storybook', import.meta.url)),
            }),
          ],
          test: { api: { port }, browser: browser(), name: 'storybook' },
        },
        {
          extends: true,
          test: {
            api: { port: port + 1 },
            browser: browser(),
            include: ['src/**/*.test.{ts,tsx}'],
            name: 'unit',
          },
        },
      ],
    },
  })
);
