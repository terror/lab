import { ToolConversation } from '@/components/tools/types';
import { renderWithQuery } from '@/test/helpers';
import { expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';

import { artifactRenderers } from './tools/artifacts';

test('a full-screen artifact opens focused on its dialog so Escape closes it', async () => {
  const { screen } = await renderWithQuery(
    artifactRenderers.artifact_create.inline({
      active: false,
      args: { content: 'foo', id: 'bar', title: 'baz' },
      callId: 'qux',
      details: { title: 'baz', version: 1 },
      history: [],
      output: '',
    })
  );

  await screen.getByRole('button', { name: 'Full screen' }).click();

  await expect.element(screen.getByRole('dialog')).toHaveFocus();

  await userEvent.keyboard('{Escape}');

  await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
});

test('a building artifact draws one more cell of its face for every 600 characters', async () => {
  const { screen } = await renderWithQuery(
    <ToolConversation value={7}>
      {artifactRenderers.artifact_create.inline({
        active: true,
        args: { content: 'foo'.repeat(400), id: 'bar', title: 'baz' },
        callId: 'qux',
        details: undefined,
        history: [],
        output: '',
      })}
    </ToolConversation>
  );

  const lit = [...screen.container.querySelectorAll('[data-slot=sigil] rect')]
    .filter((cell) => cell.getAttribute('opacity') === '1')
    .map((cell) => `${cell.getAttribute('x')},${cell.getAttribute('y')}`);

  expect(lit).toEqual(['6.5,6.5', '6.5,0.5', '3.5,6.5', '9.5,6.5']);
});
