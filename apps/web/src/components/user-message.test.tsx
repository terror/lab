import '@/index.css';
import { expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import { QueuedMessage } from './user-message';

test('a queued message says so after its text and can be cancelled', async () => {
  const onCancel = vi.fn();

  const screen = await render(
    <QueuedMessage bubble={{ id: 'foo', text: 'bar' }} onCancel={onCancel} />
  );

  await screen.getByRole('button', { name: 'Cancel queued message' }).click();

  expect({
    cancels: onCancel.mock.calls.length,
    text: screen.container.textContent,
  }).toEqual({ cancels: 1, text: 'barQueued' });
});
