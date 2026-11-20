import { preferencesQueryOptions } from '@/lib/preferences';
import { renderHookWithQuery } from '@/test/helpers';
import { defaultPreferences } from '@lab/server/schemas';
import { QueryClient } from '@tanstack/react-query';
import { expect, test } from 'vitest';

import { say, useEmpty } from './voice';

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

test('a stall says the model is slow, and drops the reassurance when quiet', () => {
  expect(
    [false, true].map((quiet) =>
      say('stall', undefined, { quiet, seed: 'foo' })
    )
  ).toEqual([
    'still on it, the model is slow right now',
    'the model is slow right now',
  ]);
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
