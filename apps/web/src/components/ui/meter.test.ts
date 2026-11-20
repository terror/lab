import { expect, test } from 'vitest';

import { surface } from './meter';

test('the flask fills by area, so half spent sits below half height', () => {
  expect([0, 0.25, 0.5, 1, 2].map(surface)).toEqual([
    29, 24.76923076923077, 21.22222222222222, 5, 5,
  ]);
});
