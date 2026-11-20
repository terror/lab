import { renderWithQuery } from '@/test/helpers';
import { expect, test } from 'vitest';

import { EmptyState } from './empty-state';

test('a pose plays its entrance once a session, then holds still', async () => {
  const entrances = [];

  for (const _ of [1, 2]) {
    const { screen } = await renderWithQuery(
      <EmptyState description='foo' pose='drained' title='bar' />
    );

    entrances.push(
      screen.container
        .querySelector('[data-slot=empty-glyph]')
        ?.getAttribute('data-enter')
    );

    await screen.unmount();
  }

  expect(entrances).toEqual(['true', null]);
});
