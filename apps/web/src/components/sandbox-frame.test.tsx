import { expect, test } from 'vitest';
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
