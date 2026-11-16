import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import type { ConversationId } from '@earendil-works/pi-durable';
import { expect, test } from 'bun:test';

import { signIn } from '../test/auth';
import app from './app';
import { harness } from './harness';

async function call(
  headers: Headers,
  method: string,
  path: string,
  body?: unknown
) {
  const response = await app.request(`/api${path}`, {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      ...Object.fromEntries(headers),
      'content-type': 'application/json',
    },
    method,
  });

  const text = await response.text();

  return { body: text ? JSON.parse(text) : null, status: response.status };
}

async function idle(id: number) {
  const conversation = await harness.conversation(
    id as ConversationId,
    BACKGROUND_CONTEXT
  );

  await conversation?.waitForIdle(BACKGROUND_CONTEXT);
}

async function create(headers: Headers) {
  const { body } = await call(headers, 'POST', '/conversations', {
    content: 'foo',
  });

  await idle(body.id);

  return body.id as number;
}

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
    body: { conversations: [{ id, title: 'foo' }] },
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
        { id: first, title: 'foo' },
        { id: second, title: 'foo' },
      ],
    },
    status: 200,
  });
});

test('conversations can be renamed', async () => {
  const headers = await signIn();

  const id = await create(headers);

  expect(
    await call(headers, 'PATCH', `/conversations/${id}`, { title: 'bar' })
  ).toEqual({ body: null, status: 204 });

  expect(await call(headers, 'GET', '/conversations')).toEqual({
    body: { conversations: [{ id, title: 'bar' }] },
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
    body: { conversations: [] },
    status: 200,
  });
});

test('conversations are hidden from other users', async () => {
  const id = await create(await signIn());

  const headers = await signIn();

  expect(await call(headers, 'GET', '/conversations')).toEqual({
    body: { conversations: [] },
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
  await hidden('PATCH', '', { title: 'bar' });
  await hidden('DELETE', '');
});
