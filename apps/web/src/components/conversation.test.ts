import { expect, test } from 'vitest';

import { type Row, mergeReplies } from './conversation';

function reply(key: string, text: string): Row {
  return {
    key,
    kind: 'assistant',
    parts: [{ text, type: 'text' }],
  };
}

function user(key: string): Row {
  return {
    bubble: { id: key, text: 'foo' },
    key,
    kind: 'user',
  };
}

test('consecutive replies merge into one row per turn', () => {
  expect(
    mergeReplies([
      user('a'),
      reply('b', 'foo'),
      reply('c', 'bar'),
      user('d'),
      reply('e', 'baz'),
    ])
  ).toEqual([
    user('a'),
    {
      key: 'b',
      kind: 'assistant',
      parts: [
        { text: 'foo', type: 'text' },
        { text: 'bar', type: 'text' },
      ],
    },
    user('d'),
    reply('e', 'baz'),
  ]);
});
