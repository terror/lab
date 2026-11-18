import * as Sentry from '@sentry/bun';
import { expect, test } from 'bun:test';

import { sentryOptions } from './instrument';

test('error reports leave out request bodies, queries, addresses and console output', async () => {
  const events = new Array<Sentry.ErrorEvent>();

  Sentry.init({
    ...sentryOptions,
    beforeSend: (event) => {
      events.push(event);

      return null;
    },
    dsn: 'http://foo@127.0.0.1/1',
  });

  const server = Bun.serve({
    fetch: async (request) => {
      await request.text();

      console.error('foo');

      Sentry.captureException(new Error('bar'));

      return new Response();
    },
    hostname: '127.0.0.1',
    port: 0,
  });

  await fetch(new URL('/baz?qux=quux', server.url), {
    body: JSON.stringify({ apiKey: 'corge' }),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  });

  await server.stop();

  await Sentry.close();

  expect(
    events.map(({ breadcrumbs, request, user }) => ({
      breadcrumbs,
      data: request?.data,
      query: request?.query_string,
      url: request?.url,
      user,
    }))
  ).toEqual([
    {
      breadcrumbs: undefined,
      data: undefined,
      query: undefined,
      url: new URL('/baz', server.url).href,
      user: undefined,
    },
  ]);
});
