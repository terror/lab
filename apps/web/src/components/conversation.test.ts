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

function entry(message: object, data?: object) {
  return {
    entry: { data, model: [message] },
    kind: 'entry',
  } as unknown as TranscriptItem;
}

function toolResult(toolCallId: string, isError: boolean, data?: object) {
  return entry(
    {
      content: [{ text: 'foo', type: 'text' }],
      isError,
      role: 'toolResult',
      timestamp: 9,
      toolCallId,
      toolName: 'bar',
    },
    data
  );
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

test('tool results carry when they ran and whether they were stopped', () => {
  expect(
    Object.fromEntries(
      toolResults([
        entry({
          content: [{ arguments: {}, id: 'a', name: 'bar', type: 'toolCall' }],
          durationMs: 2,
          role: 'assistant',
          timestamp: 1,
        }),
        toolResult('a', false),
        toolResult('b', true),
        toolResult('c', true, {
          diagnostics: [{ code: 'aborted', message: 'baz', severity: 'error' }],
        }),
      ])
    )
  ).toEqual({
    a: { output: 'foo', span: { end: 9, start: 3 }, status: 'done' },
    b: { output: 'foo', status: 'failed' },
    c: { output: 'foo', status: 'stopped' },
  });
});
