import type { TranscriptItem } from '@earendil-works/pi-durable';
import { expect, test } from 'vitest';

import { type Row, type Span, mergeReplies, toolResults } from './conversation';

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
    entryId: 1,
    key,
    kind: 'user',
  };
}

function toolResult(toolCallId: string, extra: object, data?: object) {
  return {
    entry: {
      data,
      model: [
        {
          content: [{ text: 'foo', type: 'text' }],
          isError: false,
          role: 'toolResult',
          timestamp: 9,
          toolCallId,
          toolName: 'bar',
          ...extra,
        },
      ],
    },
    kind: 'entry',
  } as unknown as TranscriptItem;
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

test('tool results tell failed from stopped', () => {
  expect(
    Object.fromEntries(
      toolResults([
        toolResult('a', {}),
        toolResult('b', { isError: true }),
        toolResult(
          'c',
          { isError: true },
          {
            diagnostics: [
              { code: 'aborted', message: 'baz', severity: 'error' },
            ],
          }
        ),
      ])
    )
  ).toEqual({
    a: { output: 'foo', status: 'done' },
    b: { output: 'foo', status: 'failed' },
    c: { output: 'foo', status: 'stopped' },
  });
});
