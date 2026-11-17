import { expect, test, vi } from 'vitest';

import { type CommandContext, matchCommands } from './commands';

const none: CommandContext = {
  conversationId: undefined,
  lastReply: undefined,
  newChat: undefined,
};

function names(draft: string, available: CommandContext) {
  return matchCommands(draft, available).map(({ name }) => name);
}

test('commands are offered only where they apply', () => {
  const context = { conversationId: 1, lastReply: 'foo', newChat: vi.fn() };

  expect([
    names('/', context),
    names('/co', context),
    names('/', { ...none, conversationId: 1 }),
    names('/', none),
    names('foo /', context),
  ]).toEqual([
    ['compact', 'copy', 'new'],
    ['compact', 'copy'],
    ['compact'],
    [],
    [],
  ]);
});

test('copy and new act on the chat', async () => {
  const write = vi
    .spyOn(navigator.clipboard, 'writeText')
    .mockResolvedValue(undefined);

  const newChat = vi.fn();

  const context = { conversationId: 1, lastReply: 'foo', newChat };

  const run = (name: string) =>
    matchCommands(`/${name}`, context)[0]?.run(context);

  expect([await run('copy'), await run('new')]).toEqual([
    'Copied the last reply.',
    undefined,
  ]);

  expect([write.mock.calls, newChat.mock.calls]).toEqual([[['foo']], [[]]]);
});
