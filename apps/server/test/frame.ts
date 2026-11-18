import { runInNewContext } from 'node:vm';

import app from '../src/app';

type Listener = (event: unknown) => void;

type Lab = {
  store: {
    delete: (key: string) => Promise<void>;
    get: (key: string) => Promise<unknown>;
    set: (key: string, value: unknown) => Promise<void>;
  };
};

function frame() {
  const loads: Listener[] = [];

  const received: unknown[] = [];

  return {
    addEventListener: (_type: string, listener: Listener) =>
      loads.push(listener),
    classList: { toggle: () => undefined },
    contentWindow: {
      postMessage: (message: unknown) => received.push(message),
    },
    html: '',
    loads,
    received,
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
    call(data: object) {
      dispatch({
        data: { ...data, type: 'call' },
        ports: [],
        source: rendered.contentWindow,
      });
    },
    navigator,
    posted,
    received: () => rendered.received,
    render(html: string, scripts: boolean) {
      port.onmessage({ data: { html, scripts, type: 'render' } });
      return rendered.html;
    },
    reply(data: object) {
      port.onmessage({ data: { ...data, type: 'reply' } });
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

export async function bridge() {
  const meta = '<meta http-equiv="x-dns-prefetch-control" content="off">';

  const script =
    new RegExp(`^${meta}<script>([^]*)</script>foo$`).exec(
      (await runner()).render('foo', true)
    )?.[1] ?? '';

  const listeners: Listener[] = [];

  const posted: unknown[] = [];

  const parent = { postMessage: (message: unknown) => posted.push(message) };

  const window: { lab?: Lab } = {};

  runInNewContext(script, {
    addEventListener: (type: string, listener: Listener) =>
      type === 'message' && listeners.push(listener),
    document: { documentElement: {} },
    parent,
    ResizeObserver: class {
      observe() {}
    },
    window,
  });

  return {
    lab: window.lab,
    posted,
    reply: (data: object) =>
      listeners.forEach((listener) =>
        listener({ data: { ...data, type: 'reply' }, source: parent })
      ),
  };
}
