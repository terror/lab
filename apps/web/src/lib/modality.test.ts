import { expect, test } from 'vitest';

import { watchModality } from './modality';

test('focus rings follow Tab and stop at the next pointer press', () => {
  const root = document.createElement('div');

  const stop = watchModality(root);

  const seen = [root.dataset.modality];

  for (const event of [
    new KeyboardEvent('keydown', { key: 'a' }),
    new KeyboardEvent('keydown', { ctrlKey: true, key: 'Tab' }),
    new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true }),
    new KeyboardEvent('keydown', { key: 'a' }),
    new PointerEvent('pointerdown'),
    new KeyboardEvent('keyup', { altKey: true, key: 'Tab' }),
  ]) {
    window.dispatchEvent(event);

    seen.push(root.dataset.modality);
  }

  stop();

  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));

  seen.push(root.dataset.modality);

  expect(seen).toEqual([
    'pointer',
    'pointer',
    'pointer',
    'keyboard',
    'keyboard',
    'pointer',
    'keyboard',
    undefined,
  ]);
});
