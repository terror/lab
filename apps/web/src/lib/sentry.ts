import * as Sentry from '@sentry/react';

const DSN =
  'https://ca744fa44ef91e8c0a21cf77757b1f47@o4512444599631872.ingest.us.sentry.io/4512444607692800';

export function initSentry() {
  Sentry.init({
    dsn: DSN,
    enabled: import.meta.env.PROD,
  });
}

export const reportReactError = Sentry.reactErrorHandler();
