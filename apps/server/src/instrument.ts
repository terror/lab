import * as Sentry from '@sentry/bun';

import { env } from './env';

const failedQuery = /^(Failed query: [\s\S]*?)\nparams: [\s\S]*$/;

export const sentryOptions = {
  beforeSend: (event) => {
    for (const exception of event.exception?.values ?? []) {
      exception.value = exception.value?.replace(failedQuery, '$1');
    }

    return event;
  },
  dataCollection: { httpBodies: [], urlQueryParams: false, userInfo: false },
  environment: process.env.NODE_ENV ?? 'production',
  integrations: (integrations) =>
    integrations.filter(({ name }) => name !== 'Console'),
  release: env.RAILWAY_GIT_COMMIT_SHA,
} satisfies Sentry.BunOptions;

export function initSentry() {
  if (env.SENTRY_DSN) {
    Sentry.init({ ...sentryOptions, dsn: env.SENTRY_DSN });
  }
}
