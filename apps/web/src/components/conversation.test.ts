import { expect, test } from 'vitest';

import { type Row, type Span, mergeReplies } from './conversation';

function reply(key: string, text: string, span?: Span): Row {
  return {
    key,
    kind: 'assistant',
    parts: [{ text, type: 'text' }],
    span,
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

test('merged replies span the whole turn', () => {
  expect(
    mergeReplies([
      reply('a', 'foo', { end: 3, start: 1 }),
      reply('b', 'bar', { end: 9, start: 5 }),
    ])
  ).toEqual([
    {
      key: 'a',
      kind: 'assistant',
      parts: [
        { text: 'foo', type: 'text' },
        { text: 'bar', type: 'text' },
      ],
      span: { end: 9, start: 1 },
    },
  ]);
});
