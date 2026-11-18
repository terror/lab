import * as Sentry from '@sentry/react';

export const sentryOptions = {
  dataCollection: { httpBodies: [], urlQueryParams: false, userInfo: false },
  dsn: 'https://ca744fa44ef91e8c0a21cf77757b1f47@o4512444599631872.ingest.us.sentry.io/4512444607692800',
  enabled: import.meta.env.PROD,
  integrations: (integrations) => [
    ...integrations.filter(({ name }) => name !== 'Console'),
    Sentry.breadcrumbsIntegration({ dom: false }),
  ],
} satisfies Sentry.BrowserOptions;

export function initSentry() {
  Sentry.init(sentryOptions);
}

export const reportReactError = Sentry.reactErrorHandler();
