import * as Sentry from '@sentry/bun';
import { expect, test } from 'bun:test';
import { DrizzleQueryError } from 'drizzle-orm';

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

function capture() {
  const sent = new Array<Sentry.ErrorEvent>();

  Sentry.init({
    ...sentryOptions,
    dsn: 'http://foo@127.0.0.1/1',
    transport: (options) =>
      Sentry.createTransport(options, async ({ body }) => {
        const [, header, item] = String(body)
          .split('\n')
          .map((line) => JSON.parse(line));

        if (header.type === 'event') {
          sent.push(item);
        }

        return {};
      }),
  });

  return sent;
}

test('database error reports leave out query parameters', async () => {
  const sent = capture();

  Sentry.captureException(
    new DrizzleQueryError('select $1', ['foo'], new Error('bar'))
  );

  await Sentry.close();

  expect(
    sent.map(({ exception }) => exception?.values?.map(({ value }) => value))
  ).toEqual([['bar', 'Failed query: select $1']]);
});

test('outgoing requests send no trace headers and stay out of error reports', async () => {
  const sent = capture();

  const headers = new Array<string[]>();

  const server = Bun.serve({
    fetch: (request) => {
      headers.push([...request.headers.keys()].toSorted());

      return new Response();
    },
    hostname: '127.0.0.1',
    port: 0,
  });

  await fetch(new URL('/foo', server.url));

  await server.stop();

  Sentry.captureException(new Error('bar'));

  await Sentry.close();

  expect({
    breadcrumbs: sent.map(({ breadcrumbs }) => breadcrumbs),
    headers,
  }).toEqual({
    breadcrumbs: [undefined],
    headers: [
      ['accept', 'accept-encoding', 'connection', 'host', 'user-agent'],
    ],
  });
});
