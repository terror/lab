import '@/index.css';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

import { ActivityRow } from './activity-row';

test('an activity row is one link that holds its title and detail, with the time beside it', async () => {
  const screen = await render(
    <ul>
      <ActivityRow
        detail='bar'
        glyph='*'
        link={(row) => <a href='#baz'>{row}</a>}
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
  ]).toEqual(['#baz', '*fooquxbar', '*fooquxbar2h']);
});
