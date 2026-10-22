import { ErrorNotice } from '@/components/error-notice';
import { Component, type ErrorInfo, type ReactNode } from 'react';

export class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  render() {
    if (this.state.failed) {
      return (
        <main className='flex min-h-svh items-center justify-center p-6'>
          <ErrorNotice
            error={
              new Error('Lab couldn’t load this view. Reload to try again.')
            }
            onRetry={() => location.reload()}
            retryLabel='Reload'
          />
        </main>
      );
    }

    return this.props.children;
  }
}
