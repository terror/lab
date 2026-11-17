import { expect, test } from 'vitest';

import { ago, duration, untilRun } from './time';

const now = new Date('2026-01-10T12:00:00Z').getTime();

function before(ms: number) {
  return ago(new Date(now - ms).toISOString(), now);
}

function relative(ms: number) {
  return untilRun(new Date(ms).toISOString(), 0);
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

test('work durations read as short labels', () => {
  expect([
    duration(200),
    duration(42_000),
    duration(151_000),
    duration(3_840_000),
  ]).toEqual(['1s', '42s', '2m 31s', '1h 4m']);
});
