import { runInNewContext } from 'node:vm';

import app from '../src/app';

type Listener = (event: unknown) => void;

function frame() {
  const loads: Listener[] = [];

  return {
    addEventListener: (_type: string, listener: Listener) =>
      loads.push(listener),
    classList: { toggle: () => undefined },
    contentWindow: {},
    html: '',
    loads,
    setAttribute: () => undefined,
  };
}

export async function runner() {
  const page = await (await app.request('/frame')).text();

  const script = /<script>([^]*)<\/script>/.exec(page)?.[1] ?? '';

  const a = frame();

  const b = frame();

  const listeners: Listener[] = [];

  const navigator = { userActivation: { isActive: false } };

  const parent = {};

  const posted: unknown[] = [];

  const port = {
    onmessage: (_event: unknown) => undefined,
    postMessage: (message: unknown) => posted.push(message),
  };

  let rendered = a;

  for (const target of [a, b]) {
    Object.defineProperty(target, 'srcdoc', {
      set: (html: string) => {
        target.html = html;
        rendered = target;
        target.loads.forEach((load) => load({}));
      },
    });
  }

  runInNewContext(script, {
    addEventListener: (_type: string, listener: Listener) =>
      listeners.push(listener),
    document: { getElementById: (id: string) => (id === 'a' ? a : b) },
    navigator,
    parent,
  });

  const dispatch = (event: unknown) =>
    listeners.forEach((listener) => listener(event));

  dispatch({ data: { type: 'lab:connect' }, ports: [port], source: parent });

  return {
    navigator,
    posted,
    render(html: string, scripts: boolean) {
      port.onmessage({ data: { html, scripts, type: 'render' } });
      return rendered.html;
    },
    send(text: string) {
      dispatch({
        data: { text, type: 'send' },
        ports: [],
        source: rendered.contentWindow,
      });
    },
  };
}
