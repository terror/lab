import * as Sentry from '@sentry/bun';

import { env } from './env';

export const sentryOptions = {
  environment: process.env.NODE_ENV ?? 'production',
  release: env.RAILWAY_GIT_COMMIT_SHA,
} satisfies Sentry.BunOptions;

export function initSentry() {
  if (env.SENTRY_DSN) {
    Sentry.init({ ...sentryOptions, dsn: env.SENTRY_DSN });
  }
}
