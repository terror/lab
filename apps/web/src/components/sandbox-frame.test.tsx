import { expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import { SandboxFrame } from './sandbox-frame';

test('generated content runs in an isolated, offline frame', async () => {
  const screen = await render(<SandboxFrame html='foo' title='bar' />);

  const frame = screen.getByTitle('bar').element();

  expect({
    allow: frame.getAttribute('allow'),
    referrer: frame.getAttribute('referrerpolicy'),
    sandbox: frame.getAttribute('sandbox'),
    src: frame.getAttribute('src'),
  }).toEqual({
    allow: '',
    referrer: 'no-referrer',
    sandbox: 'allow-scripts allow-forms',
    src: '/frame',
  });
});

test('calls from the frame get the handler’s answer or its error', async () => {
  const ports: MessagePort[] = [];

  vi.spyOn(HTMLIFrameElement.prototype, 'contentWindow', 'get').mockReturnValue(
    Object.assign(Object.create(Window.prototype), {
      postMessage: (
        _message: unknown,
        _origin: string,
        transfer: MessagePort[]
      ) => ports.push(...transfer),
    })
  );

  await render(
    <SandboxFrame
      html='foo'
      onCall={async (method, args) => {
        if (method === 'bar') {
          return args;
        }

        throw new Error('baz');
      }}
      title='qux'
    />
  );

  await expect.poll(() => ports.length).toBe(1);

  const replies: unknown[] = [];

  const [port] = ports;

  port?.addEventListener('message', ({ data }) => replies.push(data));
  port?.start();
  port?.postMessage({ args: 'foo', id: 1, method: 'bar', type: 'call' });
  port?.postMessage({ args: 'foo', id: 2, method: 'qux', type: 'call' });

  await expect
    .poll(() => replies)
    .toEqual([
      { id: 1, type: 'reply', value: 'foo' },
      { error: 'baz', id: 2, type: 'reply' },
    ]);
});
