import { expect, test } from 'vitest';

import { cheerFor } from './cheer';

test('a turn is cheered in proportion to its work', () => {
  expect([
    cheerFor(9_999, 3),
    cheerFor(10_000, 3),
    cheerFor(119_999, 7),
    cheerFor(120_000, 1),
    cheerFor(10_000, 8),
  ]).toEqual(['idle', 'done', 'done', 'proud', 'proud']);
});
