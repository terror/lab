import { fauxAssistantMessage } from '@earendil-works/pi-ai';
import { schema } from '@lab/db';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';

import { signIn } from '../test/auth';
import { call, chat, pendingToolCall, settle } from '../test/client';
import { script, toolCall } from '../test/models';
import app from './app';
import { db } from './db';

async function key(headers: Headers) {
  const { body } = await call(headers, 'POST', '/mcp/keys', { name: 'foo' });

  return body.key as string;
}

async function connect(headers: Headers) {
  const client = new Client({ name: 'foo', version: '1.0.0' });

  const secret = await key(headers);

  await client.connect(
    new StreamableHTTPClientTransport(new URL('http://localhost/api/mcp'), {
      fetch: async (input, init) =>
        app.request(input, init, { timeout: () => undefined }),
      requestInit: { headers: { authorization: `Bearer ${secret}` } },
    })
  );

  return client;
}

function invoke(
  client: Client,
  name: string,
  args: Record<string, unknown> = {}
) {
  return client.callTool({ arguments: args, name });
}

async function json(
  client: Client,
  name: string,
  args: Record<string, unknown> = {}
) {
  const { content } = await invoke(client, name, args);

  return JSON.parse((content as { text: string }[])[0]?.text ?? '');
}

function failure(text: string) {
  return { content: [{ text, type: 'text' as const }], isError: true };
}

async function post(authorization?: string) {
  const response = await app.request('/api/mcp', {
    body: '{}',
    headers: authorization ? { authorization } : {},
    method: 'POST',
  });

  return {
    body: await response.json(),
    challenge: response.headers.get('www-authenticate'),
    status: response.status,
  };
}

function url(id: number) {
  return `http://localhost:3000/c/${id}`;
}

test('keys connect mcp clients for allowed owners until revoked', async () => {
  const headers = await signIn();

  const revoked = await key(headers);

  const { body: listed } = await call(headers, 'GET', '/mcp/keys');

  const [{ createdAt, id }] = listed.keys;

  const stranger = await call(await signIn(), 'DELETE', `/mcp/keys/${id}`);

  const deleted = await call(headers, 'DELETE', `/mcp/keys/${id}`);

  const blocked = await signIn();

  const blockedKey = await key(blocked);

  const { body: session } = await call(blocked, 'GET', '/auth/get-session');

  await db
    .update(schema.user)
    .set({ emailVerified: false })
    .where(eq(schema.user.id, session.user.id));

  const missing = {
    body: { error: 'Connect with a key from Settings → MCP' },
    challenge: 'Bearer',
    status: 401,
  };

  const stream = await app.request('/api/mcp');

  expect({
    deleted,
    listed,
    posts: [
      await post(),
      await post('Bearer foo'),
      await post(`Bearer ${revoked}`),
      await post(`Bearer ${blockedKey}`),
    ],
    stranger,
    stream: { body: await stream.json(), status: stream.status },
  }).toEqual({
    deleted: { body: null, status: 204 },
    listed: {
      keys: [
        {
          createdAt,
          id,
          lastRequest: null,
          name: 'foo',
          start: revoked.slice(0, 6),
        },
      ],
    },
    posts: [
      missing,
      missing,
      missing,
      {
        body: { error: 'This account is not allowed to use Lab.' },
        challenge: null,
        status: 403,
      },
    ],
    stranger: { body: { error: 'Key not found' }, status: 404 },
    stream: { body: { error: 'Method not allowed' }, status: 405 },
  });
});

test('chats are listed, searched, and read only by their owner', async () => {
  const headers = await signIn();

  const id = await chat(headers, { content: 'zebracorn plans' });

  await settle();

  const owner = await connect(headers);

  const stranger = await connect(await signIn());

  const { body: search } = await call(headers, 'GET', '/search?q=zebracorn');

  expect({
    list: await json(owner, 'chat_list'),
    read: await invoke(owner, 'chat_read', { id }),
    search: await json(owner, 'chat_search', { query: 'zebracorn' }),
    stranger: [
      await json(stranger, 'chat_list'),
      await invoke(stranger, 'chat_read', { id }),
      await json(stranger, 'chat_search', { query: 'zebracorn' }),
    ],
  }).toEqual({
    list: {
      conversations: [
        {
          id,
          pinned: false,
          projectId: null,
          running: false,
          title: 'foo',
          unread: true,
        },
      ],
      next: null,
    },
    read: {
      content: [
        {
          text: 'foo\n\nuser: zebracorn plans\n\nassistant: foo',
          type: 'text',
        },
      ],
    },
    search: [
      {
        id,
        projectId: null,
        snippet: '**zebracorn** plans',
        title: 'foo',
        updatedAt: search.chats[0].updatedAt,
      },
    ],
    stranger: [
      { conversations: [], next: null },
      failure(`No chat has the id ${id}.`),
      [],
    ],
  });
});

test('memories are read, remembered, and forgotten', async () => {
  const client = await connect(await signIn());

  const remembered = await json(client, 'remember', { text: 'foo' });

  const read = await json(client, 'memory_read');

  const [{ createdAt, id }] = remembered.memories;

  expect({
    forgotten: await json(client, 'forget', { id }),
    missing: await invoke(client, 'forget', { id }),
    read,
    remembered,
  }).toEqual({
    forgotten: { instructions: '', memories: [], referenceChats: false },
    missing: failure(`No memory has the id ${id}.`),
    read: remembered,
    remembered: {
      instructions: '',
      memories: [{ createdAt, id, text: 'foo' }],
      referenceChats: false,
    },
  });
});

test('the library is searched and read only by its owner', async () => {
  const headers = await signIn();

  const text = 'a'.repeat(40_005);

  await chat(headers, {
    attachments: [
      { data: 'Zm9v', mimeType: 'image/png', name: 'foo.png', type: 'image' },
      { name: 'bar.txt', text, type: 'file' },
    ],
    content: 'foo',
    model: { id: 'anthropic/claude-haiku-5.5', provider: 'vercel-ai-gateway' },
  });

  await settle();

  const { body } = await call(headers, 'GET', '/library');

  const image = body.items.find(
    ({ kind }: { kind: string }) => kind === 'image'
  );

  const file = body.items.find(({ kind }: { kind: string }) => kind === 'file');

  const owner = await connect(headers);

  const stranger = await connect(await signIn());

  expect({
    first: await invoke(owner, 'library_read', { id: file.id }),
    image: await invoke(owner, 'library_read', { id: image.id }),
    rest: await invoke(owner, 'library_read', { id: file.id, offset: 40_000 }),
    search: await json(owner, 'library_search', { kind: 'file', query: 'bar' }),
    stranger: await invoke(stranger, 'library_read', { id: file.id }),
  }).toEqual({
    first: {
      content: [
        {
          text: `bar.txt\n\n${text.slice(0, 40_000)}\n\n[Showing characters 0–40000 of 40005. Call library_read with offset 40000 to continue.]`,
          type: 'text',
        },
      ],
    },
    image: {
      content: [
        { text: 'foo.png', type: 'text' },
        { data: 'Zm9v', mimeType: 'image/png', type: 'image' },
      ],
    },
    rest: { content: [{ text: 'bar.txt\n\naaaaa', type: 'text' }] },
    search: [
      {
        chat: 'foo',
        createdAt: file.createdAt,
        id: file.id,
        kind: 'file',
        name: 'bar.txt',
        size: 40_005,
      },
    ],
    stranger: failure(`No library item has the id ${file.id}.`),
  });
});

test('tasks run in a chat the owner can open in Lab', async () => {
  const headers = await signIn();

  const owner = await connect(headers);

  const stranger = await connect(await signIn());

  script(fauxAssistantMessage('bar'));

  const done = await json(owner, 'task_run', { prompt: 'foo' });

  script(
    fauxAssistantMessage('', { errorMessage: 'baz', stopReason: 'error' })
  );

  const failed = await json(owner, 'task_run', { prompt: 'foo' });

  script(
    toolCall('ask_user', { options: ['bar', 'baz'], question: 'foo' }),
    fauxAssistantMessage('qux')
  );

  const running = await json(owner, 'task_run', {
    prompt: 'foo',
    wait_seconds: 1,
  });

  await call(headers, 'POST', `/conversations/${running.id}/answers`, {
    answer: 'baz',
    callId: await pendingToolCall(headers, running.id),
  });

  const waited = await json(owner, 'task_wait', { id: running.id });

  await settle();

  const { body } = await call(headers, 'GET', '/conversations');

  expect({
    chats: body.conversations.map(({ id }: { id: number }) => id),
    done,
    failed,
    running,
    stranger: await invoke(stranger, 'task_wait', { id: running.id }),
    waited,
  }).toEqual({
    chats: [running.id, failed.id, done.id],
    done: { answer: 'bar', id: done.id, status: 'done', url: url(done.id) },
    failed: {
      id: failed.id,
      reason: 'model_error',
      status: 'failed',
      url: url(failed.id),
    },
    running: { id: running.id, status: 'running', url: url(running.id) },
    stranger: failure(`No chat has the id ${running.id}.`),
    waited: {
      answer: 'qux',
      id: running.id,
      status: 'done',
      url: url(running.id),
    },
  });
});
