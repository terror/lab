import { expect, test } from 'bun:test';

import { signIn } from '../test/auth';
import app from './app';
import { contentSecurityPolicy } from './security';

test('inline scripts are allowed by hash', () => {
  expect(contentSecurityPolicy('<script>foo</script>').scriptSrc).toEqual([
    "'self'",
    "'wasm-unsafe-eval'",
    "'sha256-LCa0a2j/xo/5m0U8HTBBNBNCLXBkg7+g+YpeiGJm564='",
  ]);
});

test('errors are reported only to the web app Sentry host', async () => {
  const source = await Bun.file(
    new URL('../../web/src/lib/sentry.ts', import.meta.url)
  ).text();

  const [, dsn = ''] = source.match(/'(https:\/\/[^']+)'/) ?? [];

  expect(contentSecurityPolicy('').connectSrc).toEqual([
    "'self'",
    new URL(dsn).origin,
  ]);
});

test('responses carry security headers', async () => {
  const response = await app.request('/api/version');

  expect({
    frame: response.headers.get('x-frame-options'),
    permissions: response.headers.get('permissions-policy'),
    policy: response.headers.get('content-security-policy')?.split('; ')[0],
    referrer: response.headers.get('referrer-policy'),
    sniff: response.headers.get('x-content-type-options'),
    transport: response.headers.get('strict-transport-security'),
  }).toEqual({
    frame: 'DENY',
    permissions:
      'bluetooth=(), camera=(), clipboard-read=(), clipboard-write=(self), display-capture=(), geolocation=(), hid=(), idle-detection=(), microphone=(self), midi=(), payment=(), screen-wake-lock=(), serial=(), usb=()',
    policy: "base-uri 'self'",
    referrer: 'strict-origin-when-cross-origin',
    sniff: 'nosniff',
    transport: 'max-age=31536000; includeSubDomains',
  });
});

test('the API docs load one pinned script', async () => {
  const response = await app.request('/api/docs', { headers: await signIn() });

  const html = await response.text();

  expect({
    policy: response.headers.get('content-security-policy'),
    scripts: Array.from(
      html.matchAll(/<script[^>]*src=[^>]*>/g),
      ([tag]) => tag
    ),
  }).toEqual({
    policy:
      "connect-src 'self'; default-src 'self'; font-src 'self' data: https://fonts.scalar.com; frame-ancestors 'none'; img-src 'self' data:; object-src 'none'; script-src 'self' https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.81.0/dist/browser/standalone.js 'sha256-R35nR0MIjkB1w1EeroUQY7pXXvIiMMbIHp2/fHXF4pg='; style-src 'self' 'unsafe-inline' https://fonts.scalar.com",
    scripts: [
      '<script crossorigin="anonymous" integrity="sha384-DXupxC0wR1MllQMEexwTowkgKaBvZGJuwz+TU+7cHC09aC+q5vPMiJS2TW3GWjPN" src="https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.81.0/dist/browser/standalone.js">',
    ],
  });
});
