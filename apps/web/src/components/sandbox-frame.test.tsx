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

function captureFrame() {
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

  return ports;
}

test('frames render again in the new theme after a theme switch', async () => {
  const ports = captureFrame();

  await render(<SandboxFrame html='foo' title='bar' />);

  await expect.poll(() => ports.length).toBe(1);

  const schemes: unknown[] = [];

  const [port] = ports;

  port?.addEventListener('message', ({ data }) =>
    schemes.push(/color-scheme:(\w+)/.exec(data.html)?.[1])
  );
  port?.start();
  port?.postMessage({ type: 'ready' });

  await expect.poll(() => schemes).toEqual(['light']);

  document.documentElement.classList.add('dark');

  await expect.poll(() => schemes).toEqual(['light', 'dark']);

  document.documentElement.classList.remove('dark');
});

test('calls from the frame get the handler’s answer or its error', async () => {
  const ports = captureFrame();

  await render(
    <SandboxFrame
      html='foo'
      onCall={async (method, args, active) => {
        if (method === 'bar' && active) {
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
  port?.postMessage({
    active: true,
    args: 'foo',
    id: 1,
    method: 'bar',
    type: 'call',
  });
  port?.postMessage({
    active: true,
    args: 'foo',
    id: 2,
    method: 'qux',
    type: 'call',
  });

  await expect
    .poll(() => replies)
    .toEqual([
      { id: 1, type: 'reply', value: 'foo' },
      { error: 'baz', id: 2, type: 'reply' },
    ]);
});
