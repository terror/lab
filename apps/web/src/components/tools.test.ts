import { expect, test } from 'vitest';

import { type ToolRecord, toolRenderer } from './tools';

function line(
  name: string,
  active: boolean,
  args: Record<string, unknown> = {},
  details?: unknown,
  history: readonly ToolRecord[] = []
) {
  const renderer = toolRenderer(name);

  const view = { active, args, details, history, output: '' };

  return [renderer.title(view), renderer.summary?.(view)];
}

test('tools describe themselves while running and when done', () => {
  expect([
    line('chat_search', true, { query: 'foo' }),
    line('chat_search', false, { query: 'foo' }, { count: 2 }),
    line('chat_read', false, {}, { end: 3, start: 0, title: 'foo', total: 3 }),
    line('codemode', false, {}, { calls: [{}] }),
    line('library_search', false, { query: 'foo' }, { count: 1 }),
    line(
      'library_read',
      false,
      {},
      { end: 4, name: 'foo', start: 2, total: 9 }
    ),
    line('remember', false, { text: 'foo' }),
    line('forget', true),
    line('forget', false, { id: 'bar' }, { id: 'bar', text: 'foo' }),
    line('forget', false, { id: 'bar' }, { id: 'bar' }, [
      { args: { text: 'foo' }, details: { id: 'bar' }, name: 'remember' },
    ]),
    line('forget', false, { id: 'bar' }, { id: 'bar' }),
    line('skill_create', true),
    line('skill_read', false, { id: 'bar' }, { name: 'foo' }),
    line('skill_delete', false, { id: 'bar' }),
    line('foo', false),
  ]).toEqual([
    ['Searching your chats for “foo”', undefined],
    ['Searched your chats for “foo”', '2 chats'],
    ['Read “foo”', '3 characters'],
    ['Ran a script', '1 tool call'],
    ['Searched your library for “foo”', '1 file'],
    ['Read foo', 'characters 2–4 of 9'],
    ['Remembered “foo”', undefined],
    ['Forgetting a memory', undefined],
    ['Forgot “foo”', undefined],
    ['Forgot “foo”', undefined],
    ['Forgot a memory', undefined],
    ['Creating a skill', undefined],
    ['Read the “foo” skill', undefined],
    ['Deleted a skill', undefined],
    ['Ran foo', undefined],
  ]);
});
