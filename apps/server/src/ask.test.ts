import { fauxAssistantMessage } from '@earendil-works/pi-ai';
import { schema } from '@lab/db';
import { expect, test } from 'bun:test';

import { signIn, signInAdmin } from '../test/auth';
import { call, pendingToolCall, settle, toolOutputs } from '../test/client';
import { script, toolCall } from '../test/models';
import { db } from './db';
import { env } from './env';
import { conversationOwner } from './records';

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
    const { body } = await call(headers, 'GET', '/conversations/unread');

    if (body.waiting[0]?.ask) {
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
        runs: [],
        waiting: [
          {
            ask: {
              callId,
              kind: 'question',
              options: ['bar', 'baz'],
              question: 'foo',
            },
            id: body.id,
            title: null,
          },
        ],
      },
    },
  });
});

test('a chat waiting on an approval lists what it asks to do', async () => {
  const headers = await signIn();

  script(
    toolCall(
      'schedule_create',
      {
        cron: '0 9 * * *',
        description: 'Every day at 9am',
        prompt: 'bar',
        title: 'foo',
      },
      'baz'
    ),
    fauxAssistantMessage('qux')
  );

  const { body } = await call(headers, 'POST', '/conversations', {
    content: 'foo',
  });

  await untilWaiting(headers);

  const { unread } = await lists(headers);

  await call(headers, 'POST', `/conversations/${body.id}/answers`, {
    answer: 'denied',
    callId: 'baz',
  });

  await settle(body.id);

  expect(unread.waiting).toEqual([
    {
      ask: {
        action: 'Schedule “foo”',
        callId: 'baz',
        kind: 'approval',
        summary: ['Every day at 9am (0 9 * * *, UTC)', 'bar'],
      },
      id: body.id,
      title: null,
    },
  ]);
});

test('an answer is refused for a call that is not waiting, and once another answer was taken', async () => {
  const headers = await signIn();

  script(
    toolCall('ask_user', { options: ['bar', 'baz'], question: 'foo' }, 'qux'),
    fauxAssistantMessage('quux')
  );

  const { body } = await call(headers, 'POST', '/conversations', {
    content: 'foo',
  });

  await untilWaiting(headers);

  const path = `/conversations/${body.id}/answers`;

  const unknown = await call(headers, 'POST', path, {
    answer: 'bar',
    callId: 'corge',
  });

  const first = await call(headers, 'POST', path, {
    answer: 'bar',
    callId: 'qux',
  });

  const second = await call(headers, 'POST', path, {
    answer: 'baz',
    callId: 'qux',
  });

  await settle(body.id);

  const late = await call(headers, 'POST', path, {
    answer: 'bar',
    callId: 'qux',
  });

  const refused = {
    body: { error: 'This is no longer waiting for an answer.' },
    status: 409,
  };

  expect({
    first: first.status,
    late,
    outputs: await toolOutputs(headers, body.id),
    second,
    unknown,
  }).toEqual({
    first: 204,
    late: refused,
    outputs: ['The user answered: bar'],
    second: refused,
    unknown: refused,
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

test('an approval can be denied but not approved over the monthly limit', async () => {
  const headers = await signIn();

  script(
    toolCall(
      'schedule_create',
      {
        cron: '0 9 * * *',
        description: 'Every day at 9am',
        prompt: 'bar',
        title: 'foo',
      },
      'baz'
    )
  );

  const { body } = await call(headers, 'POST', '/conversations', {
    content: 'foo',
  });

  await untilWaiting(headers);

  await db.insert(schema.usageEvent).values({
    cacheRead: 0,
    cacheWrite: 0,
    conversationId: body.id,
    cost: 2,
    createdAt: new Date(),
    input: 0,
    model: 'foo',
    output: 0,
    ownerId: (await conversationOwner(body.id)) ?? '',
    provider: 'foo',
  });

  env.LAB_MONTHLY_LIMIT = 1;

  try {
    const approved = await call(
      headers,
      'POST',
      `/conversations/${body.id}/answers`,
      { answer: 'approved', callId: 'baz' }
    );

    const denied = await call(
      headers,
      'POST',
      `/conversations/${body.id}/answers`,
      { answer: 'denied', callId: 'baz' }
    );

    await settle(body.id);

    expect({
      approved,
      denied: denied.status,
      tasks: (await call(headers, 'GET', '/schedules')).body.tasks,
    }).toEqual({
      approved: {
        body: { error: 'You’ve used this month’s $1.00 limit' },
        status: 402,
      },
      denied: 204,
      tasks: [],
    });
  } finally {
    env.LAB_MONTHLY_LIMIT = undefined;
  }
});
