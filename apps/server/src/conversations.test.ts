import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { AgentDoc, type ConversationId } from '@earendil-works/pi-durable';
import { schema } from '@lab/db';
import { expect, spyOn, test } from 'bun:test';
import { eq, inArray } from 'drizzle-orm';

import { signIn } from '../test/auth';
import { call, create, idle, raw, settle } from '../test/client';
import { db } from './db';
import { harness } from './harness';
import { conversationOwner } from './records';

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
    body: {
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
    status: 200,
  });
});

test('conversations are created with the chosen model', async () => {
  const headers = await signIn();

  const { body } = await call(headers, 'POST', '/conversations', {
    content: 'foo',
    model: { id: 'anthropic/claude-haiku-5.5', provider: 'vercel-ai-gateway' },
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

  let created = 0;

  spyOn(harness, 'createConversation').mockImplementationOnce(
    async (options, context) => {
      const conversation = await createConversation(options, context);

      created = conversation.id;

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

  expect(
    await db
      .select({ id: schema.conversationDeletion.id })
      .from(schema.conversationDeletion)
      .where(eq(schema.conversationDeletion.id, created))
  ).toEqual([{ id: created }]);
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

test('images need a model that reads them', async () => {
  const headers = await signIn();

  const image = {
    data: 'Zm9v',
    mimeType: 'image/png',
    name: 'foo',
    type: 'image',
  };

  expect(
    await call(headers, 'POST', '/conversations', {
      attachments: [image],
      content: 'foo',
      model: { id: 'alibaba/qwen3-coder', provider: 'vercel-ai-gateway' },
    })
  ).toEqual({ body: { error: 'This model can’t read images' }, status: 400 });

  const id = await create(headers);

  await call(headers, 'PUT', `/conversations/${id}/model`, {
    id: 'alibaba/qwen3-coder',
    provider: 'vercel-ai-gateway',
  });

  expect(
    await call(headers, 'POST', `/conversations/${id}/messages`, {
      attachments: [image],
      content: 'bar',
    })
  ).toEqual({ body: { error: 'This model can’t read images' }, status: 400 });

  await call(headers, 'PUT', `/conversations/${id}/model`, {
    id: 'anthropic/claude-haiku-5.5',
    provider: 'vercel-ai-gateway',
  });

  expect(
    await call(headers, 'POST', `/conversations/${id}/messages`, {
      attachments: [image],
      content: 'bar',
    })
  ).toEqual({ body: { id: expect.any(Number) }, status: 202 });

  await idle(id);
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

  await idle(first);

  expect(await call(headers, 'GET', '/conversations')).toEqual({
    body: {
      conversations: [
        {
          id: first,
          pinned: false,
          projectId: null,
          running: false,
          title: 'foo',
          unread: true,
        },
        {
          id: second,
          pinned: false,
          projectId: null,
          running: false,
          title: 'foo',
          unread: true,
        },
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

  const page = await call(headers, 'GET', '/conversations?limit=1');

  expect(page).toEqual({
    body: {
      conversations: [
        {
          id: second,
          pinned: false,
          projectId: null,
          running: false,
          title: 'foo',
          unread: true,
        },
      ],
      next: expect.any(String),
    },
    status: 200,
  });

  expect(
    await call(
      headers,
      'GET',
      `/conversations?limit=1&cursor=${page.body.next}`
    )
  ).toEqual({
    body: {
      conversations: [
        {
          id: first,
          pinned: false,
          projectId: null,
          running: false,
          title: 'foo',
          unread: true,
        },
      ],
      next: null,
    },
    status: 200,
  });
});

test('paging continues after the cursor chat is deleted', async () => {
  const headers = await signIn();

  const first = await create(headers);
  const second = await create(headers);

  const page = await call(headers, 'GET', '/conversations?limit=1');

  await call(headers, 'DELETE', `/conversations/${second}`);

  expect(
    await call(
      headers,
      'GET',
      `/conversations?limit=1&cursor=${page.body.next}`
    )
  ).toEqual({
    body: {
      conversations: [
        {
          id: first,
          pinned: false,
          projectId: null,
          running: false,
          title: 'foo',
          unread: true,
        },
      ],
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

  const page = await call(
    headers,
    'GET',
    '/conversations?sort=created&limit=1'
  );

  expect(page).toEqual({
    body: {
      conversations: [
        {
          id: second,
          pinned: false,
          projectId: null,
          running: false,
          title: 'foo',
          unread: true,
        },
      ],
      next: expect.any(String),
    },
    status: 200,
  });

  expect(
    await call(
      headers,
      'GET',
      `/conversations?sort=created&limit=1&cursor=${page.body.next}`
    )
  ).toEqual({
    body: {
      conversations: [
        {
          id: first,
          pinned: false,
          projectId: null,
          running: false,
          title: 'foo',
          unread: true,
        },
      ],
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
  const third = await create(headers);

  await call(headers, 'PATCH', `/conversations/${first}`, { title: 'bar' });
  await call(headers, 'PATCH', `/conversations/${second}`, { title: 'Qux' });

  await settle();

  await db
    .update(schema.conversation)
    .set({ title: null })
    .where(eq(schema.conversation.id, third));

  const page = await call(headers, 'GET', '/conversations?sort=title&limit=2');

  expect(page).toEqual({
    body: {
      conversations: [
        {
          id: first,
          pinned: false,
          projectId: null,
          running: false,
          title: 'bar',
          unread: true,
        },
        {
          id: second,
          pinned: false,
          projectId: null,
          running: false,
          title: 'Qux',
          unread: true,
        },
      ],
      next: expect.any(String),
    },
    status: 200,
  });

  expect(
    await call(
      headers,
      'GET',
      `/conversations?sort=title&limit=2&cursor=${page.body.next}`
    )
  ).toEqual({
    body: {
      conversations: [
        {
          id: third,
          pinned: false,
          projectId: null,
          running: false,
          title: null,
          unread: true,
        },
      ],
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
      conversations: [
        {
          id: first,
          pinned: false,
          projectId: null,
          running: false,
          title: 'Foo%',
          unread: true,
        },
      ],
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
    body: {
      conversations: [
        {
          id,
          pinned: false,
          projectId: null,
          running: true,
          title: 'foo',
          unread: false,
        },
      ],
      next: null,
    },
    status: 200,
  });
});

test('read conversations are not unread', async () => {
  const headers = await signIn();

  const id = await create(headers);

  expect(await call(headers, 'POST', `/conversations/${id}/read`)).toEqual({
    body: null,
    status: 204,
  });

  expect(await call(headers, 'GET', '/conversations')).toEqual({
    body: {
      conversations: [
        {
          id,
          pinned: false,
          projectId: null,
          running: false,
          title: 'foo',
          unread: false,
        },
      ],
      next: null,
    },
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

  await settle();

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

test('conversations can be fetched', async () => {
  const headers = await signIn();

  const id = await create(headers);

  expect(await call(headers, 'GET', `/conversations/${id}`)).toEqual({
    body: { forks: [], id, projectId: null, running: false, title: 'foo' },
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
    body: {
      conversations: [
        {
          id,
          pinned: false,
          projectId: null,
          running: false,
          title: 'bar',
          unread: true,
        },
      ],
      next: null,
    },
    status: 200,
  });
});

test('deleted conversations go to the trash until purged', async () => {
  const headers = await signIn();

  const [kept, restored, purged] = [
    await create(headers),
    await create(headers),
    await create(headers),
  ];

  for (const id of [restored, purged, kept]) {
    await call(headers, 'DELETE', `/conversations/${id}`);
  }

  const trashed = await call(headers, 'GET', '/trash');

  await call(headers, 'POST', `/trash/conversation/${restored}/restore`);

  const purge = await call(headers, 'DELETE', `/trash/conversation/${purged}`);

  const after = await call(headers, 'GET', '/trash');

  const hidden = await call(headers, 'GET', `/conversations/${kept}`);

  const emptied = await call(headers, 'DELETE', '/trash');

  const tombstones = await db
    .select({ id: schema.conversationDeletion.id })
    .from(schema.conversationDeletion)
    .where(inArray(schema.conversationDeletion.id, [kept, restored, purged]));

  expect({
    after: after.body.items.map(({ id }: { id: number }) => id),
    emptied: emptied.body,
    hidden,
    again: (await call(headers, 'DELETE', `/trash/conversation/${purged}`))
      .status,
    listed: (
      await call(headers, 'GET', '/conversations')
    ).body.conversations.map(({ id }: { id: number }) => id),
    purge,
    tombstones: tombstones.map(({ id }) => id).toSorted((a, b) => a - b),
    trash: (await call(headers, 'GET', '/trash')).body.items,
    trashed: trashed.body.items.map(
      ({ id, kind, title }: { id: number; kind: string; title: string }) => [
        id,
        kind,
        title,
      ]
    ),
  }).toEqual({
    after: [kept],
    again: 404,
    emptied: { chats: [kept] },
    hidden: { body: { error: 'Conversation not found' }, status: 404 },
    listed: [restored],
    purge: { body: { chats: [purged] }, status: 200 },
    tombstones: [kept, purged].toSorted((a, b) => a - b),
    trash: [],
    trashed: [
      [kept, 'conversation', 'foo'],
      [purged, 'conversation', 'foo'],
      [restored, 'conversation', 'foo'],
    ],
  });
});

test('conversations can be pinned', async () => {
  const headers = await signIn();

  const pinned = await create(headers);
  const recent = await create(headers);

  await call(headers, 'PATCH', `/conversations/${pinned}`, { pinned: true });

  const ids = async (filter: string) => {
    const { body } = await call(
      headers,
      'GET',
      `/conversations?filter=${filter}`
    );

    return body.conversations.map(
      ({ id, pinned: flag }: { id: number; pinned: boolean }) => [id, flag]
    );
  };

  expect({
    all: await ids('all'),
    patch: await call(headers, 'PATCH', `/conversations/${recent}`, {}),
    pinned: await ids('pinned'),
    recent: await ids('recent'),
  }).toEqual({
    all: [
      [recent, false],
      [pinned, true],
    ],
    patch: { body: { error: '✖ Nothing to update' }, status: 400 },
    pinned: [[pinned, true]],
    recent: [[recent, false]],
  });
});

test('attachments must fit the model context window', async () => {
  const headers = await signIn();

  const id = await create(headers);

  expect(
    await call(headers, 'POST', `/conversations/${id}/messages`, {
      attachments: [
        { name: 'foo.txt', text: 'x'.repeat(256_001), type: 'file' },
      ],
      content: 'bar',
    })
  ).toEqual({
    body: {
      error: 'These files have too much text for anthropic/claude-sonnet-5.5',
    },
    status: 400,
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

  await hidden('GET', '');
  await hidden('GET', '/entries');
  await hidden('GET', '/events');
  await hidden('POST', '/messages', { content: 'bar' });
  await hidden('PUT', '/model', {
    id: 'anthropic/claude-haiku-5.5',
    provider: 'vercel-ai-gateway',
  });
  await hidden('POST', '/abort');
  await hidden('POST', '/compact');
  await hidden('GET', '/entries/1/images/0');
  await hidden('DELETE', '/submissions/1');
  await hidden('PATCH', '', { title: 'bar' });
  await hidden('DELETE', '');
});

test('images are served by url instead of inline', async () => {
  const headers = await signIn();

  const { body } = await call(headers, 'POST', '/conversations', {
    attachments: [
      { data: 'Zm9v', mimeType: 'image/png', name: 'foo.png', type: 'image' },
    ],
    content: 'bar',
    model: { id: 'anthropic/claude-haiku-5.5', provider: 'vercel-ai-gateway' },
  });

  await idle(body.id);

  const entries = await call(
    headers,
    'GET',
    `/conversations/${body.id}/entries?order=ascending`
  );

  const message = entries.body.items.find(
    ({ kind }: { kind: string }) => kind === 'lab.message'
  );

  const image = await raw(
    headers,
    `/conversations/${body.id}/entries/${message.id}/images/0`
  );

  const missing = await raw(
    headers,
    `/conversations/${body.id}/entries/${message.id}/images/1`
  );

  expect({
    content: message.model[0].content,
    image: [image.headers.get('content-type'), await image.text()],
    missing: missing.status,
  }).toEqual({
    content: [
      { text: 'bar', type: 'text' },
      { data: '', mimeType: 'image/png', type: 'image' },
    ],
    image: ['image/png', 'foo'],
    missing: 404,
  });
});

test('unread conversations from the last day are listed with a preview', async () => {
  const headers = await signIn();

  const id = await create(headers);

  const old = await create(headers);

  await settle();

  await db
    .update(schema.conversation)
    .set({ lastMessageAt: new Date(0) })
    .where(eq(schema.conversation.id, old));

  const ownerId = (await conversationOwner(id)) ?? '';

  await db.insert(schema.scheduledTask).values({
    conversationId: id,
    cron: '0 9 * * *',
    description: 'foo',
    ownerId,
    prompt: 'foo',
    timezone: 'UTC',
    title: 'foo',
  });

  const { body } = await call(headers, 'GET', '/conversations/unread');

  expect(body).toEqual({
    chats: [
      {
        finishedAt: body.chats[0].finishedAt,
        id,
        preview: 'foo',
        scheduled: true,
        title: 'foo',
      },
    ],
    running: 0,
  });

  await call(headers, 'POST', `/conversations/${id}/read`);

  expect(await call(headers, 'GET', '/conversations/unread')).toEqual({
    body: { chats: [], running: 0 },
    status: 200,
  });
});

test('running conversations are counted instead of listed as unread', async () => {
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

  expect(await call(headers, 'GET', '/conversations/unread')).toEqual({
    body: { chats: [], running: 1 },
    status: 200,
  });
});
