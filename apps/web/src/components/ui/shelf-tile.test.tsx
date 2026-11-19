import '@/index.css';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

import { ShelfTile } from './shelf-tile';

test('a shelf tile is a button, or the link it is given', async () => {
  const screen = await render(
    <>
      <ShelfTile glyph='*' meta='bar' title='foo' />
      <ShelfTile
        glyph='*'
        link={(tile) => <a href='#qux'>{tile}</a>}
        title='baz'
      />
    </>
  );

  expect(
    [...screen.container.querySelectorAll('[data-slot=shelf-tile]')].map(
      (tile) => [tile.tagName, tile.getAttribute('href'), tile.textContent]
    )
  ).toEqual([
    ['BUTTON', null, '*foobar'],
    ['A', '#qux', '*baz'],
  ]);
});
