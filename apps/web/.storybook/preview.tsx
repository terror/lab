import addonA11y from '@storybook/addon-a11y';
import addonDocs from '@storybook/addon-docs';
import addonThemes, { withThemeByClassName } from '@storybook/addon-themes';
import { definePreview } from '@storybook/tanstack-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LazyMotion, MotionConfig, domAnimation } from 'motion/react';

import { TooltipProvider } from '../src/components/ui/tooltip';
import '../src/index.css';
import { watchModality } from '../src/lib/modality';
import { modelsQueryOptions } from '../src/lib/models';
import { spring } from '../src/lib/motion';
import { catalog } from './fixtures';

watchModality();

export default definePreview({
  addons: [addonDocs(), addonA11y(), addonThemes()],
  decorators: [
    withThemeByClassName({
      defaultTheme: 'light',
      themes: { dark: 'dark', light: 'light' },
    }),
    (Story) => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: Infinity } },
      });

      queryClient.setQueryData(modelsQueryOptions.queryKey, catalog);

      return (
        <QueryClientProvider client={queryClient}>
          <LazyMotion features={domAnimation} strict>
            <MotionConfig reducedMotion='user' transition={spring.glide}>
              <TooltipProvider>
                <Story />
              </TooltipProvider>
            </MotionConfig>
          </LazyMotion>
        </QueryClientProvider>
      );
    },
  ],
  parameters: {
    a11y: { test: 'error' },
    layout: 'centered',
    options: {
      storySort: {
        order: [
          'Foundations',
          [
            'Introduction',
            'Color',
            'Typography',
            'Shape and elevation',
            'Motion',
          ],
          'Components',
          'Patterns',
        ],
      },
    },
  },
});
