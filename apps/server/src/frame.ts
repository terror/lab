import { Hono } from 'hono';
import { fileURLToPath } from 'node:url';

import { env } from './env';

const bridge = `<script>
(() => {
  delete window.RTCPeerConnection;
  delete window.webkitRTCPeerConnection;
  const send = (message) => parent.postMessage(message, '*');
  const calls = new Map();
  let called = 0;
  const call = (method, args) => new Promise((resolve, reject) => {
    called += 1;
    calls.set(called, { reject, resolve });
    send({ args, id: called, method, type: 'call' });
  });
  addEventListener('message', (event) => {
    const reply = event.source === parent && event.data && event.data.type === 'reply' && calls.get(event.data.id);
    if (reply) {
      calls.delete(event.data.id);
      if (typeof event.data.error === 'string') {
        reply.reject(new Error(event.data.error));
      } else {
        reply.resolve(event.data.value);
      }
    }
  });
  const store = {
    delete: async (key) => {
      await call('store.delete', { key: String(key) });
    },
    get: async (key) => {
      const value = await call('store.get', { key: String(key) });
      return typeof value === 'string' ? JSON.parse(value) : null;
    },
    set: async (key, value) => {
      await call('store.set', { key: String(key), value: JSON.stringify(value) ?? 'null' });
    },
  };
  window.lab = { send: (text) => send({ type: 'send', text: String(text).slice(0, 2000) }), store };
  const size = () => send({ type: 'size', height: Math.ceil(document.documentElement.getBoundingClientRect().height) });
  new ResizeObserver(size).observe(document.documentElement);
  addEventListener('load', size);
  addEventListener('error', (event) => send({ type: 'error', message: String(event.message) }));
  addEventListener('unhandledrejection', (event) => send({ type: 'error', message: String(event.reason) }));
  addEventListener('securitypolicyviolation', (event) => send({ type: 'error', message: 'Blocked ' + event.effectiveDirective + ' ' + event.blockedURI }));
})();
</script>`;

const prefetch = '<meta http-equiv="x-dns-prefetch-control" content="off">';

function literal(value: string) {
  return JSON.stringify(value).replaceAll('<', '\\u003c');
}

const runner = `(() => {
  const frames = [document.getElementById('a'), document.getElementById('b')];
  let shown = 0;
  let pending = -1;
  let port;
  const calls = new Map();
  let called = 0;
  const show = (index) => {
    frames.forEach((frame, other) => frame.classList.toggle('pending', other !== index));
  };
  frames.forEach((frame, index) => {
    frame.addEventListener('load', () => {
      if (index === pending) {
        shown = index;
        pending = -1;
        show(index);
      }
    });
  });
  const current = (source) => [shown, pending].some((index) => index >= 0 && frames[index].contentWindow === source);
  addEventListener('message', (event) => {
    const data = event.data;
    if (!port && event.source === parent && data && data.type === 'lab:connect' && event.ports[0]) {
      port = event.ports[0];
      port.onmessage = ({ data: message }) => {
        if (message && message.type === 'render' && typeof message.html === 'string') {
          const scripts = message.scripts !== false;
          const next = 1 - shown;
          pending = next;
          calls.forEach((call, id) => {
            if (call.source === frames[next].contentWindow) {
              calls.delete(id);
            }
          });
          frames[next].setAttribute('sandbox', scripts ? 'allow-scripts allow-forms' : 'allow-forms');
          frames[next].srcdoc = ${literal(prefetch)} + (scripts ? ${literal(bridge)} : '') + message.html;
        }
        const call = message && message.type === 'reply' && calls.get(message.id);
        if (call) {
          calls.delete(message.id);
          call.source.postMessage({ error: message.error, id: call.id, type: 'reply', value: message.value }, '*');
        }
      };
      port.postMessage({ type: 'ready' });
      return;
    }
    if (!port || !current(event.source) || !data) {
      return;
    }
    if (data.type === 'size' && Number.isFinite(data.height)) {
      if (event.source === frames[shown].contentWindow) {
        port.postMessage({ type: 'size', height: Math.min(Math.max(data.height, 0), 10000) });
      }
    }
    if (data.type === 'error' && typeof data.message === 'string') {
      port.postMessage({ type: 'error', message: data.message.slice(0, 500) });
    }
    if (data.type === 'send' && typeof data.text === 'string' && navigator.userActivation.isActive) {
      port.postMessage({ type: 'send', text: data.text.slice(0, 2000) });
    }
    if (data.type === 'call' && typeof data.method === 'string' && Number.isInteger(data.id)) {
      called += 1;
      calls.set(called, { id: data.id, source: event.source });
      port.postMessage({ args: data.args, id: called, method: data.method, type: 'call' });
    }
  });
})();`;

const page = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>html,body{margin:0;background:transparent}body{position:relative}iframe{display:block;width:100%;height:100vh;border:0}iframe.pending{position:absolute;top:0;left:0;visibility:hidden;pointer-events:none}</style>
</head>
<body>
<iframe id="a" sandbox="allow-scripts allow-forms" title="Content"></iframe>
<iframe class="pending" id="b" sandbox="allow-scripts allow-forms" title="Content"></iframe>
<script>${runner}</script>
</body>
</html>`;

export function framePolicy(origin: string) {
  return [
    'sandbox allow-scripts allow-forms',
    "default-src 'none'",
    `script-src 'unsafe-inline' 'unsafe-eval' ${origin}/frame/vendor/`,
    "style-src 'unsafe-inline'",
    'img-src data: blob:',
    'media-src data: blob:',
    'font-src data:',
    "connect-src 'none'",
    "webrtc 'block'",
    "form-action 'none'",
    "base-uri 'none'",
    "object-src 'none'",
    `frame-ancestors ${origin}`,
  ].join('; ');
}

const frameLibraries: Record<string, string> = {
  'chart.js': 'chart.js/dist/chart.umd.min.js',
  'd3.js': 'd3/dist/d3.min.js',
};

function libraryFile(path: string) {
  return Bun.file(
    fileURLToPath(new URL(`../node_modules/${path}`, import.meta.url))
  );
}

const frame = new Hono()
  .get('/vendor/:name', async (c) => {
    const path = frameLibraries[c.req.param('name')];

    if (!path) {
      return c.notFound();
    }

    return c.body(await libraryFile(path).arrayBuffer(), 200, {
      'cache-control': 'public, max-age=86400',
      'content-type': 'text/javascript; charset=utf-8',
      'cross-origin-resource-policy': 'cross-origin',
      'x-content-type-options': 'nosniff',
    });
  })
  .get('/', (c) => {
    const origin = new URL(env.LAB_ORIGIN).origin;

    return c.html(page, 200, {
      'cache-control': 'no-store',
      'connection-allowlist': `("${origin}/frame/vendor/*")`,
      'content-security-policy': framePolicy(origin),
      'permissions-policy':
        'camera=(), microphone=(), geolocation=(), payment=(), usb=(), display-capture=(), clipboard-read=(), clipboard-write=()',
      'referrer-policy': 'no-referrer',
      'x-content-type-options': 'nosniff',
      'x-dns-prefetch-control': 'off',
    });
  });

export default frame;
