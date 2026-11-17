import { fauxAssistantMessage } from '@earendil-works/pi-ai';
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
