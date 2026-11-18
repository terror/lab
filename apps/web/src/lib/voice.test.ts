import { preferencesQueryOptions } from '@/lib/preferences';
import { renderHookWithQuery } from '@/test/helpers';
import { defaultPreferences } from '@lab/server/schemas';
import { QueryClient } from '@tanstack/react-query';
import { act } from 'react';
import { expect, test, vi } from 'vitest';

import { say, useEmpty, useThinking } from './voice';

function check(at: Date, absent: number, expected: string[]) {
  const greetings = Array.from({ length: 40 }, (_, index) =>
    say(
      'greeting',
      { absent, at, name: 'Foo Bar' },
      { quiet: false, seed: `bar${index}` }
    )
  );

  expect(new Set(greetings)).toEqual(new Set(expected));
}

test('the greeting reads the calendar, the clock, and time away', () => {
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

test('a long wait climbs from thinking to a note that it can be left', async () => {
  vi.useFakeTimers();

  const client = new QueryClient();

  client.setQueryData(preferencesQueryOptions.queryKey, defaultPreferences);

  try {
    let turn = 'foo';

    const { rerender, result } = await renderHookWithQuery(
      () => useThinking(turn),
      client
    );

    const lines = [result.current];

    for (const after of [4_000, 16_000, 70_000]) {
      await act(() => vi.advanceTimersByTime(after));

      lines.push(result.current);
    }

    turn = 'bar';

    await rerender();

    lines.push(result.current);

    expect(lines).toEqual([
      'Thinking',
      'Stirring it in',
      'Still on it',
      'You can leave this, I’ll mark it when it’s done',
      'Thinking',
    ]);
  } finally {
    vi.useRealTimers();
  }
});

test('a quiet wait always says thinking', () => {
  expect(
    [0, 1, 2, 3].map((tier) =>
      say('thinking', tier, { quiet: true, seed: 'foo' })
    )
  ).toEqual(['Thinking', 'Thinking', 'Thinking', 'Thinking']);
});

async function emptyTrash(personality: 'default' | 'quiet') {
  const client = new QueryClient();

  client.setQueryData(preferencesQueryOptions.queryKey, {
    ...defaultPreferences,
    personality,
  });

  const { result } = await renderHookWithQuery(() => useEmpty('trash'), client);

  return result.current;
}

test('an empty view keeps its plain words and still glyph when quiet', async () => {
  expect({
    default: await emptyTrash('default'),
    quiet: await emptyTrash('quiet'),
  }).toEqual({
    default: {
      description:
        'Chats and projects you delete wait here until you restore them or delete them for good.',
      pose: 'drained',
      title: 'Nothing to throw out',
    },
    quiet: {
      description: 'Chats and projects you delete land here.',
      title: 'All clean',
    },
  });
});
