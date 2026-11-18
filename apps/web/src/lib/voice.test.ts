import { expect, test } from 'vitest';

import { say } from './voice';

test('the greeting reads the calendar, the clock, and time away', () => {
  function greetings(at: Date, absent: number) {
    return new Set(
      Array.from({ length: 40 }, (_, index) =>
        say(
          'greeting',
          { absent, at, name: 'Foo Bar' },
          { quiet: false, seed: `bar${index}` }
        )
      )
    );
  }

  function check(at: Date, absent: number, expected: string[]) {
    expect(greetings(at, absent)).toEqual(new Set(expected));
  }

  check(new Date(2027, 0, 1, 10), 20, [
    'Happy new year, Foo',
    'New year, Foo. Clean notebook.',
    'First day of the year, Foo. Something small?',
  ]);
  check(new Date(2026, 10, 16, 9), 20, [
    'Welcome back, Foo',
    'There you are, Foo. Everything is where you left it.',
    'Long time, Foo. The bench is clean.',
  ]);
  check(new Date(2026, 10, 16, 9), 0, [
    'Good morning, Foo',
    'Monday, Foo. Fresh notebook.',
    'New week, Foo. What’s first?',
  ]);
  check(new Date(2026, 10, 20, 18), 0, [
    'Good evening, Foo',
    'Friday night, Foo. One last experiment?',
    'It’s Friday, Foo. Something small?',
  ]);
  check(new Date(2026, 10, 22, 10), 0, [
    'Good morning, Foo',
    'No rush today, Foo.',
    'Slow Sunday, Foo?',
  ]);
  check(new Date(2026, 10, 18, 2), 0, [
    'Up late, Foo?',
    'Still here, Foo? So is the bench light.',
    'Night shift, Foo.',
  ]);
  check(new Date(2026, 10, 18, 9), 0, [
    'Good morning, Foo',
    'Morning, Foo. What are we working on?',
    'Morning, Foo. The bench is set.',
  ]);
  check(new Date(2026, 10, 18, 14), 0, [
    'Good afternoon, Foo',
    'Afternoon, Foo. What are we working on?',
    'Hello, Foo. Pull up a stool.',
  ]);
  check(new Date(2026, 10, 18, 20), 0, [
    'Good evening, Foo',
    'Evening, Foo. What’s on the bench?',
    'Evening, Foo. One more experiment?',
  ]);
});

test('a quiet greeting is the plain one for the hour', () => {
  expect(
    [2, 9, 14, 20].map((hour) =>
      say(
        'greeting',
        { absent: 20, at: new Date(2027, 0, 1, hour), name: 'Foo Bar' },
        { quiet: true, seed: 'bar' }
      )
    )
  ).toEqual([
    'Up late, Foo?',
    'Good morning, Foo',
    'Good afternoon, Foo',
    'Good evening, Foo',
  ]);
});
