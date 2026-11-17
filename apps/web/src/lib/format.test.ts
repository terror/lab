import { expect, test } from 'vitest';

import { formatBytes, plural, shortDate } from './format';

test('values are formatted for people to read', () => {
  expect([
    shortDate('2026-01-02T12:00:00Z'),
    shortDate('foo'),
    formatBytes(512),
    formatBytes(70_700),
    formatBytes(3_200_000),
    plural(1, 'step'),
    plural(2, 'step'),
  ]).toEqual(['Jan 2', '', '512 B', '70.7 KB', '3.2 MB', '1 step', '2 steps']);
});
