import * as Sentry from '@sentry/bun';

import { env } from './env';

export function initSentry() {
  if (env.SENTRY_DSN) {
    Sentry.init({
      dsn: env.SENTRY_DSN,
      environment: process.env.NODE_ENV ?? 'production',
      release: env.RAILWAY_GIT_COMMIT_SHA,
    });
  }
}
