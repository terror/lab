import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

import { EmptyState } from './empty-state';

test('a pose plays its entrance once a session, then holds still', async () => {
  const entrances = [];

  for (const _ of [1, 2]) {
    const screen = await render(
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
