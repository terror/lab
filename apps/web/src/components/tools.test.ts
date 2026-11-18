import { expect, test } from 'vitest';

import { failedTitle, type ToolRecord, toolRenderer } from './tools';

function line(
  name: string,
  active: boolean,
  args: Record<string, unknown> = {},
  details?: unknown,
  history: readonly ToolRecord[] = []
) {
  const renderer = toolRenderer(name);

  const view = { active, args, callId: 'bar', details, history, output: '' };

  return [renderer.title(view), renderer.summary?.(view)];
}

test('tools describe themselves while running and when done', () => {
  expect([
    line('chat_search', true, { query: 'foo' }),
    line('chat_search', false, { query: 'foo' }, { count: 2 }),
    line('chat_read', false, {}, { end: 3, start: 0, title: 'foo', total: 3 }),
    line('codemode', false, {}, { calls: [{}] }),
    line('delegate', true, { tasks: [{ title: 'foo' }, { title: 'bar' }] }),
    line(
      'delegate',
      false,
      {},
      { subagents: [{ status: 'done' }, { status: 'failed' }] }
    ),
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
    line('web_search', false, { query: 'foo' }, { count: 2 }),
    line('web_fetch', false, {}, { domain: 'bar.com', title: 'foo' }),
    line('ask_user', true),
    line('plan_update', true),
    line('plan_update', false),
    line(
      'sandbox_exec',
      false,
      { command: 'ls\npwd' },
      { durationMs: 1500, exitCode: 0 }
    ),
    line('sandbox_write', false, { path: 'bar.txt' }, { size: 3 }),
    line('sandbox_save', false, {}, { name: 'bar.csv' }),
    line('image_generate', true, { images: [1] }),
    line('image_generate', false, {}, { name: 'foo.png' }),
    line('schedule_create', false, {}, { task: { title: 'foo' } }),
    line('foo', false),
    line('tool_search', true),
    line('mcp__foo__bar', false),
  ]).toEqual([
    ['Searching your chats for “foo”', undefined],
    ['Searched your chats for “foo”', '2 chats'],
    ['Read “foo”', '3 characters'],
    ['Ran a script', '1 tool call'],
    ['Delegating 2 tasks', '0 of 2 done'],
    ['Delegated 2 tasks', '1 of 2 done'],
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
    ['Searched the web for “foo”', '2 results'],
    ['Read “foo”', 'bar.com'],
    ['Asking you a question', undefined],
    ['Updating the plan', undefined],
    ['Updated the plan', undefined],
    ['Ran ls', 'exit 0 · 1.5s'],
    ['Wrote bar.txt', '3 B'],
    ['Saved bar.csv to your library', undefined],
    ['Editing an image', undefined],
    ['Created foo.png', undefined],
    ['Scheduled “foo”', undefined],
    ['Ran foo', undefined],
    ['Finding tools', undefined],
    ['Used bar from foo', undefined],
  ]);
});

test('a tool the user declined says what it didn’t do', () => {
  const details = { approval: { decision: 'denied' } };

  expect([
    line('project_update', false, {}, details),
    line('schedule_create', false, {}, details),
    line('skill_create', false, {}, details),
    line('skill_update', false, {}, details),
    line('trash_purge', false, {}, details),
  ]).toEqual([
    ['Didn’t change a project', undefined],
    ['Didn’t schedule a task', undefined],
    ['Didn’t save a skill', undefined],
    ['Didn’t change a skill', undefined],
    ['Didn’t delete forever', undefined],
  ]);
});

test('a failed tool says what it couldn’t do', () => {
  expect([
    failedTitle('Running foo'),
    failedTitle('Searching the web for “foo”'),
    failedTitle('Foo bar'),
  ]).toEqual([
    'Couldn’t run foo',
    'Couldn’t search the web for “foo”',
    'Foo bar failed',
  ]);
});
