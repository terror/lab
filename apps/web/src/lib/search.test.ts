import { expect, test } from 'vitest';

import { ago } from './search';

const now = new Date('2026-01-10T12:00:00Z').getTime();

function before(ms: number) {
  return ago(new Date(now - ms).toISOString(), now);
}

test('result times read as short relative labels', () => {
  expect([
    before(30_000),
    before(5 * 60_000),
    before(3 * 3_600_000),
    before(30 * 3_600_000),
    before(4 * 86_400_000),
    before(30 * 86_400_000),
  ]).toEqual(['1m', '5m', '3h', 'Yesterday', 'Tue', 'Dec 11']);
});
