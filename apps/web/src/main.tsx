import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { LazyMotion, MotionConfig, domAnimation } from 'motion/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { ThemeProvider } from './components/theme-provider';
import { TooltipProvider } from './components/ui/tooltip';
import './index.css';
import { router } from './router';

const queryClient = new QueryClient();
const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element not found');
}

createRoot(root).render(
  <StrictMode>
    <ThemeProvider defaultTheme='system' storageKey='vite-ui-theme'>
      <LazyMotion features={domAnimation} strict>
        <MotionConfig reducedMotion='user'>
          <QueryClientProvider client={queryClient}>
            <TooltipProvider>
              <RouterProvider router={router} />
            </TooltipProvider>
          </QueryClientProvider>
        </MotionConfig>
      </LazyMotion>
    </ThemeProvider>
  </StrictMode>
);
