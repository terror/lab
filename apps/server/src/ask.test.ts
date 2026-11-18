import { fauxAssistantMessage } from '@earendil-works/pi-ai';
import { expect, test } from 'bun:test';

import { signIn, signInAdmin } from '../test/auth';
import { call, pendingToolCall, settle, toolOutputs } from '../test/client';
import { script, toolCall } from '../test/models';

test('the agent waits for the user to answer its question', async () => {
  const headers = await signIn();

  script(
    toolCall('ask_user', { options: ['bar', 'baz'], question: 'foo' }),
    fauxAssistantMessage('qux')
  );

  const { body } = await call(headers, 'POST', '/conversations', {
    content: 'foo',
  });

  const callId = await pendingToolCall(headers, body.id);

  const waiting = await toolOutputs(headers, body.id);

  const answered = await call(
    headers,
    'POST',
    `/conversations/${body.id}/answers`,
    { answer: 'baz', callId }
  );

  await settle(body.id);

  expect({
    answered: answered.status,
    outputs: await toolOutputs(headers, body.id),
    waiting,
  }).toEqual({
    answered: 204,
    outputs: ['The user answered: baz'],
    waiting: [],
  });
});

async function untilWaiting(headers: Headers) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const { body } = await call(headers, 'GET', '/conversations');

    if (body.conversations[0]?.waiting) {
      return;
    }

    await Bun.sleep(20);
  }

  throw new Error('Not waiting');
}

async function lists(headers: Headers) {
  const [list, unread] = await Promise.all([
    call(headers, 'GET', '/conversations'),
    call(headers, 'GET', '/conversations/unread'),
  ]);

  return { list: list.body, unread: unread.body };
}

test('a chat is listed as waiting while its question is unanswered', async () => {
  const headers = await signIn();

  script(
    toolCall('ask_user', { options: ['bar', 'baz'], question: 'foo' }),
    fauxAssistantMessage('qux')
  );

  const { body } = await call(headers, 'POST', '/conversations', {
    content: 'foo',
  });

  const callId = await pendingToolCall(headers, body.id);

  await untilWaiting(headers);

  const waiting = await lists(headers);

  await call(headers, 'POST', `/conversations/${body.id}/answers`, {
    answer: 'baz',
    callId,
  });

  await settle(body.id);

  const answered = await call(headers, 'GET', '/conversations');

  expect({ answered: answered.body.conversations, waiting }).toEqual({
    answered: [
      {
        id: body.id,
        pinned: false,
        projectId: null,
        running: false,
        title: 'foo',
        unread: true,
        waiting: false,
      },
    ],
    waiting: {
      list: {
        conversations: [
          {
            id: body.id,
            pinned: false,
            projectId: null,
            running: true,
            title: null,
            unread: false,
            waiting: true,
          },
        ],
        next: null,
      },
      unread: {
        chats: [],
        running: 0,
        waiting: [{ id: body.id, title: null }],
      },
    },
  });
});

test('an answer only settles the call it was given for', async () => {
  const headers = await signIn();

  const task = {
    cron: '0 9 * * *',
    description: 'Every day at 9am',
    prompt: 'bar',
    title: 'foo',
  };

  script(toolCall('schedule_create', task, 'baz'), fauxAssistantMessage('qux'));

  const { body } = await call(headers, 'POST', '/conversations', {
    content: 'foo',
  });

  await untilWaiting(headers);

  await call(headers, 'POST', `/conversations/${body.id}/answers`, {
    answer: 'approved',
    callId: 'baz',
  });

  await settle(body.id);

  script(
    toolCall('schedule_create', { ...task, title: 'quux' }, 'baz'),
    fauxAssistantMessage('qux')
  );

  await call(headers, 'POST', `/conversations/${body.id}/messages`, {
    content: 'foo',
  });

  await untilWaiting(headers);

  await call(headers, 'POST', `/conversations/${body.id}/answers`, {
    answer: 'denied',
    callId: 'baz',
  });

  await settle(body.id);

  const { tasks } = (await call(headers, 'GET', '/schedules')).body;

  expect(tasks.map(({ title }: { title: string }) => title)).toEqual(['foo']);
});

test('a chat stops waiting once its approval is answered', async () => {
  const headers = await signInAdmin();

  const reached = Promise.withResolvers<void>();

  const released = Promise.withResolvers<void>();

  const server = Bun.serve({
    fetch: async () => {
      reached.resolve();

      await released.promise;

      return new Response(null, { status: 500 });
    },
    hostname: '127.0.0.1',
    port: 0,
  });

  script(
    toolCall(
      'connector_add',
      { name: 'Foo', url: `${server.url.href}mcp` },
      'foo'
    ),
    fauxAssistantMessage('bar')
  );

  const { body } = await call(headers, 'POST', '/conversations', {
    content: 'foo',
  });

  await untilWaiting(headers);

  await call(headers, 'POST', `/conversations/${body.id}/answers`, {
    answer: 'approved',
    callId: 'foo',
  });

  await reached.promise;

  const { list, unread } = await lists(headers);

  released.resolve();

  await settle(body.id);

  await server.stop(true);

  for (const { id } of (await call(headers, 'GET', '/connectors')).body
    .connectors) {
    await call(headers, 'DELETE', `/connectors/${id}`);
  }

  expect({
    listed: list.conversations.find(({ id }: { id: number }) => id === body.id)
      ?.waiting,
    waiting: unread.waiting,
  }).toEqual({ listed: false, waiting: [] });
});
