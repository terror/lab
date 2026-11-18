import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

import { Tile } from './library-tile';

test('pdfs with a thumbnail show their first page', async () => {
  const item = {
    conversation: { id: 1, title: 'foo' },
    createdAt: '2026-01-01T00:00:00.000Z',
    id: 7,
    kind: 'file' as const,
    mimeType: 'text/plain',
    name: 'foo.pdf',
    preview: 'bar',
    size: 3,
  };

  const tile = async (upload: { id: string; thumbnail: boolean } | null) => {
    const screen = await render(
      <Tile
        item={{
          ...item,
          upload: upload && { ...upload, mimeType: 'application/pdf' },
        }}
        onOpen={() => undefined}
      />
    );

    const image = screen.container.querySelector('img')?.getAttribute('src');

    await screen.unmount();

    return image && new URL(image).pathname;
  };

  expect([
    await tile({ id: 'baz', thumbnail: true }),
    await tile({ id: 'baz', thumbnail: false }),
    await tile(null),
  ]).toEqual(['/api/library/7/thumbnail', undefined, undefined]);
});
