import { preferencesQueryOptions } from '@/lib/preferences';
import { renderHookWithQuery } from '@/test/helpers';
import { defaultPreferences } from '@lab/server/schemas';
import { QueryClient } from '@tanstack/react-query';
import { expect, test } from 'vitest';

import { brief, say, useEmpty } from './voice';

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

function text(finished: number, needs: number, running: number, quiet = false) {
  return brief({ finished, needs, running }, quiet)
    .map((part) =>
      part.kind === undefined ? part.text : `${part.count} ${part.text}`
    )
    .join('');
}

test('the brief names what happened, and is plain counts when quiet', () => {
  expect([
    text(0, 0, 0),
    text(1, 1, 1),
    text(3, 2, 2),
    text(2, 0, 1),
    text(0, 1, 2),
    text(0, 0, 1),
    text(0, 2, 0),
    text(1, 2, 1, true),
  ]).toEqual([
    '',
    '1 chat finished and 1 needs you. 1 is still running.',
    '3 chats finished and 2 need you. 2 are still running.',
    '2 chats finished. 1 is still running.',
    '1 chat needs you. 2 are still running.',
    '1 chat is running.',
    '2 chats need you.',
    '1 finished · 2 need you · 1 running',
  ]);
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
