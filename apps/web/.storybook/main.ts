import { defineMain } from '@storybook/tanstack-react/node';

export default defineMain({
  addons: [
    '@storybook/addon-docs',
    '@storybook/addon-a11y',
    '@storybook/addon-themes',
    '@storybook/addon-vitest',
  ],
  core: { disableTelemetry: true, disableWhatsNewNotifications: true },
  framework: '@storybook/tanstack-react',
  stories: ['../src/**/*.mdx', '../src/**/*.stories.tsx'],
});
