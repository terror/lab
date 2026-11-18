import type { TranscriptItem } from '@earendil-works/pi-durable';
import { expect, test } from 'vitest';

import {
  keyRows,
  type Part,
  type Row,
  type Span,
  mergeReplies,
  queuedMessages,
  streamRows,
  toolHistory,
  toolResults,
} from './transcript';

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

function keyed(row: Row) {
  return { key: row.key, row };
}

function streamed(key: string, parts: Part[]) {
  return { key, row: { key, kind: 'assistant', parts, streaming: true } };
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

test('queued messages show what was typed and attached, not the prompt', () => {
  expect(
    queuedMessages({
      items: [
        {
          content: [
            {
              text: 'foo\n\n<file name="bar.txt">\nbaz\n</file>',
              type: 'text',
            },
            { data: 'cXV4', mimeType: 'image/png', type: 'image' },
          ],
          entry: {
            data: {
              files: [
                { name: 'bar.txt', text: 'baz', type: 'file' },
                { name: 'qux.png', type: 'image' },
              ],
              text: 'foo',
            },
            kind: 'lab.message',
          },
          id: 7,
          mode: 'followUp',
        },
      ],
    } as unknown as Parameters<typeof queuedMessages>[0])
  ).toEqual([
    {
      bubble: {
        files: [{ name: 'bar.txt' }],
        id: 'queued-7',
        images: ['data:image/png;base64,cXV4'],
        text: 'foo',
      },
      submission: 7,
    },
  ]);
});

test('a streaming reply joins the last reply or starts the next one', () => {
  const foo: Part = { text: 'foo', type: 'text' };

  const bar: Part = { text: 'bar', type: 'text' };

  expect(streamRows(keyRows([user('a'), reply('b', 'foo')]), [])).toEqual([
    keyed(user('a')),
    { key: 'reply-a-1', row: reply('b', 'foo') },
  ]);

  expect(
    streamRows(keyRows([user('a'), reply('b', 'foo', { end: 2, start: 1 })]), [
      bar,
    ])
  ).toEqual([
    keyed(user('a')),
    {
      key: 'reply-a-1',
      row: {
        key: 'reply-a-1',
        kind: 'assistant',
        parts: [foo, bar],
        span: { end: 2, start: 1 },
        streaming: true,
      },
    },
  ]);

  expect(
    streamRows(keyRows([user('a'), reply('b', 'foo'), user('c')]), [bar])
  ).toEqual([
    keyed(user('a')),
    { key: 'reply-a-1', row: reply('b', 'foo') },
    keyed(user('c')),
    streamed('reply-c-1', [bar]),
  ]);

  expect(streamRows(keyRows([]), [bar])).toEqual([
    streamed('reply-start-1', [bar]),
  ]);
});

test('tool history lists every call with its result details', () => {
  expect(
    toolHistory(
      [
        user('a'),
        {
          key: 'b',
          kind: 'assistant',
          parts: [
            { text: 'foo', type: 'text' },
            { arguments: { bar: 1 }, id: 'c', name: 'baz', type: 'toolCall' },
            { arguments: {}, id: 'd', name: 'qux', type: 'toolCall' },
          ],
        },
      ],
      new Map([['c', { details: 'quux', output: '', status: 'done' }]])
    )
  ).toEqual([
    { args: { bar: 1 }, details: 'quux', name: 'baz' },
    { args: {}, details: undefined, name: 'qux' },
  ]);
});
