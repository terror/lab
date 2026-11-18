import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { LazyMotion, MotionConfig, domAnimation } from 'motion/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { Toaster } from './components/ui/sonner';
import { TooltipProvider } from './components/ui/tooltip';
import './index.css';
import { watchModality } from './lib/modality';
import { spring } from './lib/motion';
import { queryClient } from './lib/query-client';
import { initSentry, reportReactError } from './lib/sentry';
import { router } from './router';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element not found');
}

initSentry();

watchModality();

createRoot(root, {
  onCaughtError: reportReactError,
  onRecoverableError: reportReactError,
  onUncaughtError: reportReactError,
}).render(
  <StrictMode>
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion='user' transition={spring.glide}>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <RouterProvider router={router} />
            <Toaster position='top-center' />
          </TooltipProvider>
        </QueryClientProvider>
      </MotionConfig>
    </LazyMotion>
  </StrictMode>
);
