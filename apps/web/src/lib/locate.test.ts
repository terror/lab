import { expect, test, vi } from 'vitest';

import { locate } from './locate';

test('locating a result scrolls to it, focuses it and washes it again each time', () => {
  const target = document.createElement('div');

  target.id = 'foo:bar';
  target.tabIndex = -1;
  target.dataset.located = '';
  document.body.append(target);

  const scroll = vi.spyOn(target, 'scrollIntoView');

  const found = [locate('foo:bar'), locate('baz')];

  expect({
    focused: document.activeElement === target,
    found,
    located: target.hasAttribute('data-located'),
    scrolled: scroll.mock.calls,
  }).toEqual({
    focused: true,
    found: [true, false],
    located: true,
    scrolled: [[{ behavior: 'smooth', block: 'nearest' }]],
  });

  target.remove();
});
