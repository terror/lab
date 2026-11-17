import {
  MutationCache,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { LazyMotion, MotionConfig, domAnimation } from 'motion/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { toast } from 'sonner';

import { Toaster } from './components/ui/sonner';
import { TooltipProvider } from './components/ui/tooltip';
import './index.css';
import { initSentry, reportReactError } from './lib/sentry';
import { router } from './router';

declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: { inlineError?: boolean };
  }
}

const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (!mutation.meta?.inlineError) {
        toast.error(error.message);
      }
    },
  }),
});

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element not found');
}

initSentry();

createRoot(root, {
  onCaughtError: reportReactError,
  onRecoverableError: reportReactError,
  onUncaughtError: reportReactError,
}).render(
  <StrictMode>
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion='user'>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <RouterProvider router={router} />
            <Toaster position='bottom-center' />
          </TooltipProvider>
        </QueryClientProvider>
      </MotionConfig>
    </LazyMotion>
  </StrictMode>
);
