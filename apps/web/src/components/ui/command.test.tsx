import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

import { CommandDialog } from './command';

test('a command dialog names itself only while it is open', async () => {
  const screen = await render(
    <CommandDialog description='bar' open={false} title='foo' />
  );

  const closed = screen.container.textContent;

  await screen.rerender(<CommandDialog description='bar' open title='foo' />);

  await expect
    .element(screen.getByRole('dialog', { name: 'foo' }))
    .toHaveAccessibleDescription('bar');

  expect(closed).toBe('');
});
