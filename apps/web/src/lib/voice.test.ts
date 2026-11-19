import { preferencesQueryOptions } from '@/lib/preferences';
import { renderHookWithQuery } from '@/test/helpers';
import { defaultPreferences } from '@lab/server/schemas';
import { QueryClient } from '@tanstack/react-query';
import { act } from 'react';
import { expect, test, vi } from 'vitest';

import { say, useEmpty, useThinking } from './voice';

test('greetings vary between work prompts', () => {
  const greetings = Array.from({ length: 40 }, (_, index) =>
    say('greeting', undefined, { quiet: false, seed: `foo${index}` })
  );

  expect(new Set(greetings)).toEqual(
    new Set([
      'What are we working on?',
      'What would you like to make?',
      'What should we tackle next?',
      'What would you like to explore?',
      'Where should we start?',
      'What can I help with?',
    ])
  );
});

test('a quiet greeting is a fixed work prompt', () => {
  expect(say('greeting', undefined, { quiet: true, seed: 'foo' })).toBe(
    'What are we working on?'
  );
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
