import type { ToolResult } from '@/components/tools';
import { expect, test } from 'vitest';

import { runTiming, steps } from './spans';
import type { Part, Row } from './transcript';

function call(id: string, name = 'foo', content = '') {
  return { arguments: { content }, id, name, type: 'toolCall' } as const;
}

function done(span?: ToolResult['span']): ToolResult {
  return { output: '', span, status: 'done' };
}

test('a turn’s steps say where the model thought, where it kept Lab waiting, and which calls it spent time writing', () => {
  const long = call('e', 'foo', 'bar'.repeat(700));

  const parts: Part[] = [
    { thinking: 'foo', type: 'thinking' },
    call('a'),
    { text: 'bar', type: 'text' },
    call('b'),
    call('c'),
    long,
    call('d'),
  ];

  expect(
    steps(
      parts,
      [
        { at: 0, parts: 2, span: { end: 4_000, start: 0 } },
        { at: 2, parts: 2, span: { end: 11_000, start: 10_000 } },
        { at: 4, parts: 1, span: { end: 17_000, start: 12_000 } },
        { at: 5, parts: 1, span: { end: 40_000, start: 17_000 } },
      ],
      new Map([
        ['a', done({ end: 6_000, start: 4_000 })],
        ['b', done()],
        ['e', done({ end: 41_000, start: 40_000 })],
      ])
    )
  ).toEqual([
    { key: 'round-0', kind: 'thought', span: { end: 4_000, start: 0 } },
    { call: call('a'), kind: 'tool', span: { end: 6_000, start: 4_000 } },
    { key: 'gap-10000', kind: 'waited', span: { end: 10_000, start: 6_000 } },
    { call: call('b'), kind: 'tool' },
    {
      key: 'round-12000',
      kind: 'waited',
      span: { end: 17_000, start: 12_000 },
    },
    { call: call('c'), kind: 'tool' },
    { call: long, kind: 'tool', span: { end: 41_000, start: 17_000 } },
    { call: call('d'), kind: 'tool' },
  ]);
});

test('a run is timed from when it was seen starting, or else from its record, less time spent asking', () => {
  const rows: Row[] = [
    {
      bubble: { id: 'a', text: 'foo' },
      entryId: 1,
      key: 'a',
      kind: 'user',
      sent: 1_000,
    },
    {
      key: 'b',
      kind: 'assistant',
      parts: [call('c', 'ask_user')],
      rounds: [{ at: 0, parts: 1, span: { end: 3_000, start: 2_000 } }],
    },
  ];

  const results = new Map([['c', done({ end: 9_000, start: 3_000 })]]);

  const timing = (first: number | undefined, fresh: boolean) =>
    runTiming(rows, results, {
      first,
      requested: undefined,
      seen: { at: 5_000, fresh },
    });

  expect([
    timing(1, false),
    timing(undefined, false),
    timing(1, true),
    runTiming([], results, {
      first: undefined,
      requested: 7_000,
      seen: { at: 8_000, fresh: false },
    }),
    runTiming([], results, {
      first: undefined,
      requested: undefined,
      seen: { at: 8_000, fresh: false },
    }),
  ]).toEqual([
    { start: 1_000, waited: 6_000 },
    { start: 2_000, waited: 6_000 },
    { start: 5_000, waited: 4_000 },
    { start: 7_000, waited: 0 },
    { start: 8_000, waited: 0 },
  ]);
});
