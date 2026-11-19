import { renderWithQuery } from '@/test/helpers';
import axe from 'axe-core';
import type { ReactNode } from 'react';
import { expect, test } from 'vitest';

import { Tile } from './library-tile';
import { ProjectInstructions } from './project-instructions';

async function mismatches(ui: ReactNode) {
  const { screen } = await renderWithQuery(ui);

  const { violations } = await axe.run(screen.container, {
    runOnly: ['label-content-name-mismatch'],
  });

  await screen.unmount();

  return violations.flatMap(({ nodes }) => nodes.map(({ html }) => html));
}

test('buttons name themselves with the text they show', async () => {
  expect([
    await mismatches(
      <Tile
        item={{
          conversation: { id: 1, title: 'foo' },
          createdAt: '2026-01-01T00:00:00.000Z',
          id: 7,
          kind: 'file',
          mimeType: 'text/plain',
          name: 'foo.md',
          preview: 'bar',
          size: 3,
          upload: null,
        }}
        onOpen={() => undefined}
      />
    ),
    await mismatches(
      <ProjectInstructions
        project={{ id: 7, instructions: 'bar', name: 'foo' }}
      />
    ),
  ]).toEqual([[], []]);
});
