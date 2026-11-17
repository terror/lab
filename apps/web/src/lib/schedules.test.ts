import { expect, test } from 'vitest';

import { untilRun } from './schedules';

function relative(ms: number) {
  return untilRun(new Date(ms).toISOString(), 0);
}

test('next runs read as relative times', () => {
  expect([
    relative(6 * 86_400_000),
    relative(86_400_000),
    relative(3 * 3_600_000),
    relative(5 * 60_000),
    relative(10_000),
  ]).toEqual([
    'in 6 days',
    'tomorrow',
    'in 3 hours',
    'in 5 minutes',
    'this minute',
  ]);
});
