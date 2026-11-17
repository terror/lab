import { expect, test } from 'bun:test';
import { runInNewContext } from 'node:vm';

import { runner } from '../test/frame';
import app from './app';

test('the frame runner is sandboxed, offline, and only framed by Lab', async () => {
  const response = await app.request('/frame');

  expect({
    allowlist: response.headers.get('connection-allowlist'),
    dnsPrefetch: response.headers.get('x-dns-prefetch-control'),
    frameOptions: response.headers.get('x-frame-options'),
    permissions: response.headers.get('permissions-policy'),
    policy: response.headers.get('content-security-policy'),
    referrer: response.headers.get('referrer-policy'),
    status: response.status,
  }).toEqual({
    allowlist: '("http://localhost:3000/frame/vendor/*")',
    dnsPrefetch: 'off',
    frameOptions: null,
    permissions:
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), display-capture=(), clipboard-read=(), clipboard-write=()',
    policy:
      "sandbox allow-scripts allow-forms; default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' http://localhost:3000/frame/vendor/; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data:; connect-src 'none'; webrtc 'block'; form-action 'none'; base-uri 'none'; object-src 'none'; frame-ancestors http://localhost:3000",
    referrer: 'no-referrer',
    status: 200,
  });
});

test('the frame runner relays a send only during user activation in its content', async () => {
  const frame = await runner();

  frame.render('foo', true);
  frame.send('bar');
  frame.navigator.userActivation.isActive = true;
  frame.send('baz');

  expect(frame.posted).toEqual([
    { type: 'ready' },
    { text: 'baz', type: 'send' },
  ]);
});

test('frame content turns off DNS prefetching and loses WebRTC before it runs', async () => {
  const frame = await runner();

  const meta = '<meta http-equiv="x-dns-prefetch-control" content="off">';

  const script =
    new RegExp(`^${meta}<script>([^]*)</script>foo$`).exec(
      frame.render('foo', true)
    )?.[1] ?? '';

  const content = { RTCPeerConnection: 'bar', webkitRTCPeerConnection: 'baz' };

  runInNewContext(script, {
    addEventListener: () => undefined,
    document: { documentElement: {} },
    parent: { postMessage: () => undefined },
    ResizeObserver: class {
      observe() {}
    },
    window: content,
  });

  expect({
    content: Object.keys(content),
    rendered: frame.render('foo', false),
  }).toEqual({ content: ['lab'], rendered: `${meta}foo` });
});

test('the frame serves its libraries to sandboxed content', async () => {
  const response = await app.request('/frame/vendor/chart.js');

  const missing = await app.request('/frame/vendor/foo.js');

  expect({
    missing: missing.status,
    policy: response.headers.get('cross-origin-resource-policy'),
    status: response.status,
    type: response.headers.get('content-type'),
  }).toEqual({
    missing: 404,
    policy: 'cross-origin',
    status: 200,
    type: 'text/javascript; charset=utf-8',
  });
});

test('other paths under the frame keep Lab’s own security headers', async () => {
  const paths = ['/frame/', '/frame/foo', '/frame/vendor/chart.js/foo'];

  const options = await Promise.all(
    paths.map(async (path) =>
      (await app.request(path)).headers.get('x-frame-options')
    )
  );

  expect(options).toEqual(['DENY', 'DENY', 'DENY']);
});
