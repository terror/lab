import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { fauxAssistantMessage } from '@earendil-works/pi-ai';
import type { ToolExecutionApi } from '@earendil-works/pi-durable';
import { extensions } from '@lab/harness';
import { expect, test } from 'bun:test';

import { signIn } from '../test/auth';
import {
  call,
  chat,
  create,
  pendingToolCall,
  settle,
  toolOutputs,
} from '../test/client';
import { emptyDeps } from '../test/harness';
import { script, toolCall } from '../test/models';

test('the agent manages chats and the trash', async () => {
  const headers = await signIn();

  const target = await create(headers);

  script(
    toolCall('chat_rename', { chat_id: target, title: 'foo' }),
    toolCall('chat_pin', { chat_id: target, pinned: true }),
    toolCall('chat_delete', { chat_id: target }),
    toolCall('trash_list', {}),
    toolCall('trash_restore', { id: target, kind: 'conversation' }),
    toolCall('chat_delete', { chat_id: target }),
    fauxAssistantMessage('bar')
  );

  const managing = await chat(headers, { content: 'baz' });

  script(
    toolCall('trash_purge', { id: target, kind: 'conversation' }),
    fauxAssistantMessage('bar')
  );

  const { body } = await call(headers, 'POST', '/conversations', {
    content: 'qux',
  });

  const callId = await pendingToolCall(headers, body.id);

  await call(headers, 'POST', `/conversations/${body.id}/answers`, {
    answer: 'approved',
    callId,
  });

  await settle(body.id);

  const [deletedAt] = (await toolOutputs(headers, managing))[3]?.match(
    /\d{4}-\d{2}-\d{2}/
  ) ?? [''];

  expect({
    managing: await toolOutputs(headers, managing),
    purged: await toolOutputs(headers, body.id),
    trash: (await call(headers, 'GET', '/trash')).body.items,
  }).toEqual({
    managing: [
      `Renamed chat ${target} to "foo".`,
      'Pinned "foo".',
      'Moved "foo" to the Trash.',
      `[conversation ${target}] foo (deleted ${deletedAt})`,
      `Restored conversation ${target}.`,
      'Moved "foo" to the Trash.',
    ],
    purged: [`Permanently deleted conversation ${target}.`],
    trash: [],
  });
});

test('a purge that finished before a restart reports it again', async () => {
  const approval = {
    action: 'Delete “foo” forever',
    decision: 'approved',
    summary: ['The chat will be permanently deleted.'],
  };

  const item = {
    deletedAt: '2026-01-01T00:00:00.000Z',
    id: 1,
    kind: 'conversation' as const,
    title: 'foo',
  };

  const purge = extensions({
    ...emptyDeps(),
    chats: { ...emptyDeps().chats, trashed: async () => [] },
  })
    .flatMap((extension) => extension.tools ?? [])
    .find((tool) => tool.name === 'trash_purge');

  const api = {
    conversationId: 1,
    memo: async (name: string) =>
      name === 'purged' ? { approval, item } : undefined,
  } as unknown as ToolExecutionApi;

  expect(
    await purge?.execute(
      { id: 1, kind: 'conversation' },
      api,
      BACKGROUND_CONTEXT
    )
  ).toEqual({
    details: { approval, item },
    output: [{ text: 'Permanently deleted conversation 1.', type: 'text' }],
  });
});
