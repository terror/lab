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
