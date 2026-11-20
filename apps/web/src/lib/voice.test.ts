import { expect, test } from 'vitest';

import { emptyCopy, say } from './voice';

test('greetings vary between work prompts', () => {
  const greetings = Array.from({ length: 40 }, (_, index) =>
    say('greeting', undefined, `foo${index}`)
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

test('a stall says the model is slow', () => {
  expect(say('stall', undefined, 'foo')).toBe(
    'still on it, the model is slow right now'
  );
});

test('an empty view speaks in Lab’s voice and strikes a pose', () => {
  expect(emptyCopy('trash')).toEqual({
    description:
      'Chats and projects you delete wait here until you restore them or delete them for good.',
    pose: 'drained',
    title: 'Nothing to throw out',
  });
});
