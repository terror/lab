import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { AgentDoc, type ConversationId } from '@earendil-works/pi-durable';
import { expect, spyOn, test } from 'bun:test';

import { signIn } from '../test/auth';
import { call, create, idle } from '../test/client';
import { harness } from './harness';

test('conversations require a session', async () => {
  expect(await call(new Headers(), 'GET', '/conversations')).toEqual({
    body: { error: 'Sign in to use Lab' },
    status: 401,
  });
});

test('created conversations are listed with their generated title', async () => {
  const headers = await signIn();

  const id = await create(headers);

  expect(await call(headers, 'GET', '/conversations')).toEqual({
    body: { conversations: [{ id, running: false, title: 'foo' }], next: null },
    status: 200,
  });
});

test('conversations are created with the chosen model', async () => {
  const headers = await signIn();

  const { body } = await call(headers, 'POST', '/conversations', {
    content: 'foo',
    model: 'anthropic/claude-haiku-5.5',
    thinkingLevel: 'off',
  });

  const agent = await harness.snapshot(AgentDoc, body.id, BACKGROUND_CONTEXT);

  expect([agent?.model, agent?.thinkingLevel]).toEqual([
    { modelId: 'anthropic/claude-haiku-5.5', provider: 'vercel-ai-gateway' },
    'off',
  ]);
});

test('conversations are not listed when their first message fails', async () => {
  const headers = await signIn();

  const createConversation = harness.createConversation.bind(harness);

  spyOn(harness, 'createConversation').mockImplementationOnce(
    async (options, context) => {
      const conversation = await createConversation(options, context);

      spyOn(conversation, 'submit').mockRejectedValueOnce(new Error('foo'));

      return conversation;
    }
  );

  expect(
    await call(headers, 'POST', '/conversations', { content: 'foo' })
  ).toEqual({ body: { error: 'Internal server error' }, status: 500 });

  expect(await call(headers, 'GET', '/conversations')).toEqual({
    body: { conversations: [], next: null },
    status: 200,
  });
});

test('messages need text or an attachment', async () => {
  const headers = await signIn();

  expect(
    await call(headers, 'POST', '/conversations', { content: ' ' })
  ).toEqual({
    body: { error: '✖ A message needs text or an attachment' },
    status: 400,
  });
});

test('messages are added to the transcript', async () => {
  const headers = await signIn();

  const id = await create(headers);

  expect(
    await call(headers, 'POST', `/conversations/${id}/messages`, {
      content: 'bar',
    })
  ).toEqual({ body: { id: expect.any(Number) }, status: 202 });

  await idle(id);

  const { body } = await call(
    headers,
    'GET',
    `/conversations/${id}/entries?order=ascending`
  );

  expect(
    body.items.flatMap(
      ({ kind, data }: { kind: string; data: { text: string } }) =>
        kind === 'lab.message' ? [data.text] : []
    )
  ).toEqual(['foo', 'bar']);
});

test('conversations are listed by their latest message', async () => {
  const headers = await signIn();

  const first = await create(headers);
  const second = await create(headers);

  await call(headers, 'POST', `/conversations/${first}/messages`, {
    content: 'bar',
  });

  expect(await call(headers, 'GET', '/conversations')).toEqual({
    body: {
      conversations: [
        { id: first, running: false, title: 'foo' },
        { id: second, running: false, title: 'foo' },
      ],
      next: null,
    },
    status: 200,
  });
});

test('conversations are listed in pages', async () => {
  const headers = await signIn();

  const first = await create(headers);
  const second = await create(headers);

  expect(await call(headers, 'GET', '/conversations?limit=1')).toEqual({
    body: {
      conversations: [{ id: second, running: false, title: 'foo' }],
      next: second,
    },
    status: 200,
  });

  expect(
    await call(headers, 'GET', `/conversations?limit=1&cursor=${second}`)
  ).toEqual({
    body: {
      conversations: [{ id: first, running: false, title: 'foo' }],
      next: null,
    },
    status: 200,
  });
});

test('conversations can be listed by creation', async () => {
  const headers = await signIn();

  const first = await create(headers);
  const second = await create(headers);

  await call(headers, 'POST', `/conversations/${first}/messages`, {
    content: 'bar',
  });

  expect(
    await call(headers, 'GET', '/conversations?sort=created&limit=1')
  ).toEqual({
    body: {
      conversations: [{ id: second, running: false, title: 'foo' }],
      next: second,
    },
    status: 200,
  });

  expect(
    await call(
      headers,
      'GET',
      `/conversations?sort=created&limit=1&cursor=${second}`
    )
  ).toEqual({
    body: {
      conversations: [{ id: first, running: false, title: 'foo' }],
      next: null,
    },
    status: 200,
  });
});

test('attachment names are escaped in the prompt', async () => {
  const headers = await signIn();

  const { body } = await call(headers, 'POST', '/conversations', {
    attachments: [{ name: 'foo"<bar>&', text: 'baz', type: 'file' }],
    content: 'foo',
  });

  await idle(body.id);

  const entries = await call(
    headers,
    'GET',
    `/conversations/${body.id}/entries?order=ascending`
  );

  expect(
    entries.body.items.find(
      ({ kind }: { kind: string }) => kind === 'lab.message'
    ).model[0].content
  ).toBe('foo\n\n<file name="foo&quot;&lt;bar&gt;&amp;">\nbaz\n</file>');
});

test('conversations can be listed by title', async () => {
  const headers = await signIn();

  const first = await create(headers);
  const second = await create(headers);

  await call(headers, 'PATCH', `/conversations/${first}`, { title: 'bar' });
  await call(headers, 'PATCH', `/conversations/${second}`, { title: 'Foo' });

  expect(
    await call(headers, 'GET', '/conversations?sort=title&limit=1')
  ).toEqual({
    body: {
      conversations: [{ id: first, running: false, title: 'bar' }],
      next: first,
    },
    status: 200,
  });

  expect(
    await call(
      headers,
      'GET',
      `/conversations?sort=title&limit=1&cursor=${first}`
    )
  ).toEqual({
    body: {
      conversations: [{ id: second, running: false, title: 'Foo' }],
      next: null,
    },
    status: 200,
  });
});

test('conversations can be searched by title', async () => {
  const headers = await signIn();

  const first = await create(headers);
  const second = await create(headers);

  await call(headers, 'PATCH', `/conversations/${first}`, { title: 'Foo%' });
  await call(headers, 'PATCH', `/conversations/${second}`, { title: 'foobar' });

  expect(await call(headers, 'GET', '/conversations?search=foo%25')).toEqual({
    body: {
      conversations: [{ id: first, running: false, title: 'Foo%' }],
      next: null,
    },
    status: 200,
  });
});

test('running conversations are marked in the list', async () => {
  const headers = await signIn();

  const id = await create(headers);

  const inspection = await harness.inspect(BACKGROUND_CONTEXT);

  spyOn(harness, 'inspect').mockResolvedValueOnce({
    ...inspection,
    tasks: [
      {
        record: { background: false, conversationId: id },
        state: { kind: 'running' },
      } as (typeof inspection.tasks)[number],
    ],
  });

  expect(await call(headers, 'GET', '/conversations')).toEqual({
    body: { conversations: [{ id, running: true, title: 'foo' }], next: null },
    status: 200,
  });
});

test('messages can steer the running answer', async () => {
  const headers = await signIn();

  const id = await create(headers);

  const conversation = await harness.conversation(
    id as ConversationId,
    BACKGROUND_CONTEXT
  );

  if (!conversation) {
    throw new Error('missing conversation');
  }

  const submit = spyOn(conversation, 'submit');

  spyOn(harness, 'conversation').mockResolvedValueOnce(conversation);

  await call(headers, 'POST', `/conversations/${id}/messages`, {
    content: 'bar',
    steer: true,
  });

  expect(submit).toHaveBeenCalledWith(
    {
      content: 'bar',
      entry: { data: { files: [], text: 'bar' }, kind: 'lab.message' },
      type: 'input',
      whenBusy: 'steer',
    },
    BACKGROUND_CONTEXT
  );
});

test('queued messages can be cancelled', async () => {
  const headers = await signIn();

  const id = await create(headers);

  const { body } = await call(
    headers,
    'POST',
    `/conversations/${id}/messages`,
    {
      content: 'bar',
    }
  );

  await idle(id);

  expect(
    await call(headers, 'DELETE', `/conversations/${id}/submissions/${body.id}`)
  ).toEqual({ body: { error: 'Message was already sent' }, status: 409 });

  expect(
    await call(headers, 'DELETE', `/conversations/${id}/submissions/999999`)
  ).toEqual({ body: { error: 'Message not found' }, status: 404 });

  const abort = spyOn(harness, 'abortSubmission').mockResolvedValueOnce(
    'aborted'
  );

  expect(
    await call(headers, 'DELETE', `/conversations/${id}/submissions/${body.id}`)
  ).toEqual({ body: null, status: 204 });

  expect(abort).toHaveBeenCalledWith(body.id, BACKGROUND_CONTEXT, id);
});

test('conversations can be renamed', async () => {
  const headers = await signIn();

  const id = await create(headers);

  expect(
    await call(headers, 'PATCH', `/conversations/${id}`, { title: 'bar' })
  ).toEqual({ body: null, status: 204 });

  expect(await call(headers, 'GET', '/conversations')).toEqual({
    body: { conversations: [{ id, running: false, title: 'bar' }], next: null },
    status: 200,
  });
});

test('conversations can be deleted', async () => {
  const headers = await signIn();

  const id = await create(headers);

  expect(await call(headers, 'DELETE', `/conversations/${id}`)).toEqual({
    body: null,
    status: 204,
  });

  expect(await call(headers, 'GET', '/conversations')).toEqual({
    body: { conversations: [], next: null },
    status: 200,
  });
});

test('conversations are hidden from other users', async () => {
  const id = await create(await signIn());

  const headers = await signIn();

  expect(await call(headers, 'GET', '/conversations')).toEqual({
    body: { conversations: [], next: null },
    status: 200,
  });

  async function hidden(method: string, path: string, body?: unknown) {
    expect(
      await call(headers, method, `/conversations/${id}${path}`, body)
    ).toEqual({ body: { error: 'Conversation not found' }, status: 404 });
  }

  await hidden('GET', '/entries');
  await hidden('GET', '/events');
  await hidden('POST', '/messages', { content: 'bar' });
  await hidden('PUT', '/model', { id: 'anthropic/claude-haiku-5.5' });
  await hidden('POST', '/abort');
  await hidden('DELETE', '/submissions/1');
  await hidden('PATCH', '', { title: 'bar' });
  await hidden('DELETE', '');
});
