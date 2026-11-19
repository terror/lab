import '@/index.css';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

import { Sigil } from './sigil';

test('a sigil fills a mirrored pair at a time, and only a project gets a frame', async () => {
  const screen = await render(
    <>
      <Sigil data-testid='foo' filled={2} kind='app' seed='app:1:bar' />
      <Sigil data-testid='bar' kind='project' seed='project:1' size='md' />
    </>
  );

  const read = (id: string) => {
    const svg = screen.getByTestId(id).element();

    return {
      cells: [...svg.querySelectorAll('rect')]
        .map((cell) => cell.getAttribute('opacity'))
        .join(''),
      frame: svg.querySelector('[data-part=frame]') !== null,
      width: svg.getBoundingClientRect().width,
    };
  };

  expect({ bar: read('bar'), foo: read('foo') }).toEqual({
    bar: { cells: '11111111111111111', frame: true, width: 28 },
    foo: { cells: '1110000000000', frame: false, width: 16 },
  });
});
