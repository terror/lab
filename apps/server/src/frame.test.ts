import { expect, test } from 'bun:test';

import app from './app';

test('the frame runner is sandboxed, offline, and only framed by Lab', async () => {
  const response = await app.request('/frame');

  expect({
    frameOptions: response.headers.get('x-frame-options'),
    permissions: response.headers.get('permissions-policy'),
    policy: response.headers.get('content-security-policy'),
    referrer: response.headers.get('referrer-policy'),
    status: response.status,
  }).toEqual({
    frameOptions: null,
    permissions:
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), display-capture=(), clipboard-read=(), clipboard-write=()',
    policy:
      "sandbox allow-scripts allow-forms; default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'; frame-ancestors http://localhost:3000",
    referrer: 'no-referrer',
    status: 200,
  });
});
