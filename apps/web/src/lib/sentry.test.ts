import * as Sentry from '@sentry/react';
import { expect, test, vi } from 'vitest';

import { sentryOptions } from './sentry';

test('error reports leave out addresses, queries, console output and labels', async () => {
  const sent = new Array<Record<string, unknown>>();

  vi.stubGlobal('fetch', async () => new Response());

  Sentry.init({
    ...sentryOptions,
    dsn: 'http://foo@127.0.0.1/1',
    enabled: true,
    transport: (options) =>
      Sentry.createTransport(options, async ({ body }) => {
        const [, ...lines] = String(body).split('\n');

        sent.push(
          ...lines
            .filter((_, index) => index % 2 === 1)
            .map((line) => JSON.parse(line))
        );

        return {};
      }),
  });

  await fetch('/foo?bar=baz');

  console.error('qux');

  const button = document.createElement('button');
  button.setAttribute('aria-label', 'quux');
  document.body.append(button);
  button.click();
  button.remove();

  Sentry.captureException(new Error('corge'));

  await Sentry.close();

  expect(
    sent.map(({ breadcrumbs, request, sdk, user }) => ({
      breadcrumbs: (breadcrumbs as Array<Sentry.Breadcrumb>).map(
        ({ category, data, message }) => ({ category, data, message })
      ),
      inferIp: (sdk as Sentry.SdkInfo).settings?.infer_ip,
      url: (request as Sentry.RequestEventData).url,
      user,
    }))
  ).toEqual([
    {
      breadcrumbs: [
        {
          category: 'fetch',
          data: { method: 'GET', status_code: 200, url: '/foo' },
        },
      ],
      inferIp: 'never',
      url: `${location.origin}${location.pathname}`,
    },
  ]);
});
