import { expect, test } from 'bun:test';
import { runInNewContext } from 'node:vm';

import { bridge, runner } from '../test/frame';
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

test('the frame runner relays calls and returns each reply to the frame that called', async () => {
  const frame = await runner();

  frame.render('foo', true);
  frame.call({ args: 'bar', id: 7, method: 'baz' });
  frame.render('foo', true);
  frame.render('foo', true);
  frame.navigator.userActivation.isActive = true;
  frame.call({ args: 'qux', id: 7, method: 'baz' });
  frame.reply({ id: 1, value: 'stale' });
  frame.reply({ id: 2, value: 'quux' });
  frame.reply({ id: 2, value: 'again' });

  expect({ posted: frame.posted, received: frame.received() }).toEqual({
    posted: [
      { type: 'ready' },
      { active: false, args: 'bar', id: 1, method: 'baz', type: 'call' },
      { active: true, args: 'qux', id: 2, method: 'baz', type: 'call' },
    ],
    received: [{ error: undefined, id: 7, type: 'reply', value: 'quux' }],
  });
});

test('frame content stores JSON values and asks the model through calls to its runner', async () => {
  const { lab, posted, reply } = await bridge();

  const saved = lab?.store.set('foo', { bar: 1 });
  const loaded = lab?.store.get('foo');
  const failed = lab?.store
    .delete('foo')
    .catch((error: Error) => error.message);
  const answered = lab?.ask('qux');

  reply({ id: 1 });
  reply({ id: 2, value: '{"bar":1}' });
  reply({ error: 'baz', id: 3 });
  reply({ id: 4, value: 'quux' });

  expect({
    answered: await answered,
    failed: await failed,
    loaded: await loaded,
    posted,
    saved: await saved,
  }).toEqual({
    answered: 'quux',
    failed: 'baz',
    loaded: { bar: 1 },
    posted: [
      {
        args: { key: 'foo', value: '{"bar":1}' },
        id: 1,
        method: 'store.set',
        type: 'call',
      },
      { args: { key: 'foo' }, id: 2, method: 'store.get', type: 'call' },
      { args: { key: 'foo' }, id: 3, method: 'store.delete', type: 'call' },
      { args: { prompt: 'qux' }, id: 4, method: 'ask', type: 'call' },
    ],
    saved: undefined,
  });
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
