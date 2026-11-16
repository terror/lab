import { expect, test } from 'bun:test';

import app from './app';
import { contentSecurityPolicy } from './security';

test('inline scripts are allowed by hash', () => {
  expect(contentSecurityPolicy('<script>foo</script>').scriptSrc).toEqual([
    "'self'",
    "'wasm-unsafe-eval'",
    "'sha256-LCa0a2j/xo/5m0U8HTBBNBNCLXBkg7+g+YpeiGJm564='",
  ]);
});

test('responses carry security headers', async () => {
  const response = await app.request('/api/version');

  expect({
    frame: response.headers.get('x-frame-options'),
    policy: response.headers.get('content-security-policy')?.split('; ')[0],
    referrer: response.headers.get('referrer-policy'),
    sniff: response.headers.get('x-content-type-options'),
    transport: response.headers.get('strict-transport-security'),
  }).toEqual({
    frame: 'DENY',
    policy: "base-uri 'self'",
    referrer: 'strict-origin-when-cross-origin',
    sniff: 'nosniff',
    transport: 'max-age=31536000; includeSubDomains',
  });
});
