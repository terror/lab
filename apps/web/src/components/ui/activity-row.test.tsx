import '@/index.css';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

import { ActivityRow } from './activity-row';

test('an activity row is one link that holds its title, state and detail, with the time beside it', async () => {
  const screen = await render(
    <ul>
      <ActivityRow
        detail='bar'
        glyph='*'
        label='quux'
        renderLink={(row) => <a href='#baz'>{row}</a>}
        meta='qux'
        time='2h'
        title='foo'
      />
    </ul>
  );

  const link = screen.getByRole('link').element();

  expect([
    link.getAttribute('href'),
    link.textContent,
    screen.getByRole('listitem').element().textContent,
  ]).toEqual(['#baz', '*fooquxquuxbar', '*fooquxquuxbar2h']);
});

test('a row shows its meta whole beside a title that fits, and not at all beside one that does not', async () => {
  const screen = await render(
    <ul className='w-60'>
      <ActivityRow glyph='*' meta='bar' title='foo' />
      <ActivityRow glyph='*' meta='bar' title={'foo '.repeat(20)} />
    </ul>
  );

  const shown = screen
    .getByText('bar')
    .elements()
    .map((meta) => {
      const line = meta.parentElement?.getBoundingClientRect();
      const box = meta.getBoundingClientRect();

      if (line === undefined || box.top >= line.bottom) {
        return 'absent';
      }

      return box.right <= line.right && meta.scrollWidth <= meta.clientWidth
        ? 'whole'
        : 'cut';
    });

  expect(shown).toEqual(['whole', 'absent']);
});
