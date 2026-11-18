import { expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import { RenameInput } from './chat-actions';

test('the enter that ends a composition does not rename the chat', async () => {
  const submit = vi.fn();

  const screen = await render(
    <RenameInput initial='foo' onCancel={() => {}} onSubmit={submit} />
  );

  const input = screen.getByRole('textbox', { name: 'Chat title' });

  await input.fill('bar');

  input.element().dispatchEvent(
    new KeyboardEvent('keydown', {
      bubbles: true,
      isComposing: true,
      key: 'Enter',
    })
  );

  expect(submit.mock.calls).toEqual([]);
});
