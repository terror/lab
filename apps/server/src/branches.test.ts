import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { AgentDoc, type ConversationId } from '@earendil-works/pi-durable';
import { schema } from '@lab/db';
import { expect, test } from 'bun:test';
import { and, asc, eq, inArray } from 'drizzle-orm';

import { signIn } from '../test/auth';
import { call, chat, create, idle, raw, settle } from '../test/client';
import { db } from './db';
import { env } from './env';
import { harness } from './harness';
import { conversationOwner } from './records';

type Item = {
  conversationId: number;
  data?: unknown;
  id: number;
  kind: string;
  model?: { content: unknown; model?: string; role: string }[];
};

async function entries(headers: Headers, id: number) {
  const { body } = await call(
    headers,
    'GET',
    `/conversations/${id}/entries?order=ascending`
  );

  return body.items as Item[];
}

function messages(items: readonly Item[]) {
  return items.flatMap(({ conversationId, data, kind, model }) =>
    kind === 'lab.message' ? [[conversationId, data, model?.[0]?.content]] : []
  );
}

async function branch(headers: Headers, id: number, body: object) {
  const created = await call(
    headers,
    'POST',
    `/conversations/${id}/branches`,
    body
  );

  await settle(created.body.id);

  return created.body.id as number;
}

async function forks(headers: Headers, id: number) {
  return (await call(headers, 'GET', `/conversations/${id}`)).body.forks;
}

function rows(
  table: typeof schema.libraryItem | typeof schema.messageText,
  ids: number[]
) {
  return db
    .select({ conversationId: table.conversationId, entryId: table.entryId })
    .from(table)
    .where(inArray(table.conversationId, ids))
    .orderBy(asc(table.entryId));
}

test('a reply is retried with another model in a branch beside the original', async () => {
  const headers = await signIn();

  const { body: created } = await call(headers, 'POST', '/projects', {
    name: 'foo',
  });

  const id = await chat(headers, {
    attachments: [{ name: 'foo.txt', text: 'bar', type: 'file' }],
    content: 'foo',
    projectId: created.project.id,
  });

  const original = await entries(headers, id);

  const [message, system, reply] = original;

  const retried = await branch(headers, id, {
    entryId: reply!.id,
    kind: 'retry',
    model: { id: 'anthropic/claude-haiku-5.5', provider: 'vercel-ai-gateway' },
  });

  const items = await entries(headers, retried);

  const answer = items.at(-1)!.id;

  const ids = [id, retried];

  const fork = { after: system!.id, chats: [id, retried] };

  expect({
    branch: items.map(({ conversationId, kind, model }) => [
      conversationId,
      kind,
      model?.[0]?.model,
    ]),
    forks: [await forks(headers, id), await forks(headers, retried)],
    history: await rows(schema.messageText, ids),
    library: await rows(schema.libraryItem, ids),
    original: await entries(headers, id),
    row: await db
      .select({
        ownerId: schema.conversation.ownerId,
        parentEntryId: schema.conversation.parentEntryId,
        parentId: schema.conversation.parentId,
        projectId: schema.conversation.projectId,
        title: schema.conversation.title,
      })
      .from(schema.conversation)
      .where(eq(schema.conversation.id, retried)),
    usage: await db
      .select({
        conversationId: schema.usageEvent.conversationId,
        entryId: schema.usageEvent.entryId,
      })
      .from(schema.usageEvent)
      .where(
        and(
          inArray(schema.usageEvent.conversationId, ids),
          eq(schema.usageEvent.kind, 'response')
        )
      )
      .orderBy(asc(schema.usageEvent.entryId)),
  }).toEqual({
    branch: [
      [id, 'lab.message', undefined],
      [id, 'pi.system', undefined],
      [retried, 'pi.assistant', 'anthropic/claude-haiku-5.5'],
    ],
    forks: [[fork], [fork]],
    history: [
      { conversationId: id, entryId: message!.id },
      { conversationId: id, entryId: reply!.id },
      { conversationId: retried, entryId: answer },
    ],
    library: [{ conversationId: id, entryId: message!.id }],
    original,
    row: [
      {
        ownerId: (await conversationOwner(id)) ?? '',
        parentEntryId: system!.id,
        parentId: id,
        projectId: created.project.id,
        title: 'foo',
      },
    ],
    usage: [
      { conversationId: id, entryId: reply!.id },
      { conversationId: retried, entryId: answer },
    ],
  });
});

test('an edited message is resent with its attachments in a branch', async () => {
  const headers = await signIn();

  const id = await chat(headers, {
    content: 'foo',
    model: { id: 'anthropic/claude-haiku-5.5', provider: 'vercel-ai-gateway' },
  });

  const file = { name: 'foo.txt', text: 'bar', type: 'file' };

  await call(headers, 'POST', `/conversations/${id}/messages`, {
    attachments: [
      { data: 'Zm9v', mimeType: 'image/png', name: 'foo.png', type: 'image' },
      file,
    ],
    content: 'baz',
  });

  await idle(id);

  const original = await entries(headers, id);

  const edited = await branch(headers, id, {
    content: 'qux',
    entryId: original.findLast(({ kind }) => kind === 'lab.message')!.id,
    kind: 'edit',
  });

  const items = await entries(headers, edited);

  const image = await raw(
    headers,
    `/conversations/${edited}/entries/${items.findLast(({ kind }) => kind === 'lab.message')!.id}/images/0`
  );

  expect({
    branch: messages(items),
    image: await image.text(),
    original: await entries(headers, id),
  }).toEqual({
    branch: [
      [id, { files: [], text: 'foo' }, 'foo'],
      [
        edited,
        { files: [{ name: 'foo.png', type: 'image' }, file], text: 'qux' },
        [
          { text: 'qux\n\n<file name="foo.txt">\nbar\n</file>', type: 'text' },
          { data: '', mimeType: 'image/png', type: 'image' },
        ],
      ],
    ],
    image: 'foo',
    original,
  });
});

test('an edited first message starts a branch with the current model', async () => {
  const headers = await signIn();

  const id = await create(headers);

  const model = {
    modelId: 'anthropic/claude-haiku-5.5',
    provider: 'vercel-ai-gateway',
  };

  await call(headers, 'PUT', `/conversations/${id}/model`, {
    id: model.modelId,
    provider: model.provider,
  });

  const [first] = await entries(headers, id);

  const edited = await branch(headers, id, {
    content: 'bar',
    entryId: first!.id,
    kind: 'edit',
  });

  const fork = { after: null, chats: [id, edited] };

  expect({
    agent: (
      await harness().snapshot(
        AgentDoc,
        edited as ConversationId,
        BACKGROUND_CONTEXT
      )
    )?.model,
    branch: messages(await entries(headers, edited)),
    forks: [await forks(headers, id), await forks(headers, edited)],
    titles: (
      await call(headers, 'GET', '/conversations')
    ).body.conversations.map(
      ({ id: listed, title }: { id: number; title: string }) => [listed, title]
    ),
  }).toEqual({
    agent: model,
    branch: [[edited, { files: [], text: 'bar' }, 'bar']],
    forks: [[fork], [fork]],
    titles: [
      [edited, 'foo'],
      [id, 'foo'],
    ],
  });
});

test('forks list every chat that branches where a chat does', async () => {
  const headers = await signIn();

  const first = await create(headers);

  const [, system, reply] = await entries(headers, first);

  const second = await branch(headers, first, {
    entryId: reply!.id,
    kind: 'retry',
  });

  const third = await branch(headers, second, {
    entryId: (await entries(headers, second)).at(-1)!.id,
    kind: 'retry',
  });

  const siblings = await forks(headers, third);

  await call(headers, 'POST', `/conversations/${second}/messages`, {
    content: 'bar',
  });

  await idle(second);

  const items = await entries(headers, second);

  const message = items.findLast(({ kind }) => kind === 'lab.message')!;

  const fourth = await branch(headers, second, {
    content: 'baz',
    entryId: message.id,
    kind: 'edit',
  });

  const before = await forks(headers, fourth);

  await call(headers, 'DELETE', `/conversations/${first}`);

  expect({
    after: await forks(headers, fourth),
    before,
    siblings,
  }).toEqual({
    after: [
      { after: system!.id, chats: [fourth, third] },
      { after: items.at(-3)!.id, chats: [second, fourth] },
    ],
    before: [
      { after: system!.id, chats: [first, fourth, third] },
      { after: items.at(-3)!.id, chats: [second, fourth] },
    ],
    siblings: [{ after: system!.id, chats: [first, second, third] }],
  });
});

test('branches are refused like messages', async () => {
  const headers = await signIn();

  const id = await create(headers);

  const [message, , reply] = await entries(headers, id);

  async function refused(
    as: Headers,
    body: object,
    status: number,
    error: string
  ) {
    expect(
      await call(as, 'POST', `/conversations/${id}/branches`, body)
    ).toEqual({ body: { error }, status });
  }

  await refused(
    headers,
    { entryId: message!.id, kind: 'retry' },
    404,
    'Message not found'
  );
  await refused(
    headers,
    { content: 'foo', entryId: reply!.id, kind: 'edit' },
    404,
    'Message not found'
  );
  await refused(
    headers,
    { content: ' ', entryId: message!.id, kind: 'edit' },
    400,
    '✖ A message needs text\n  → at content'
  );
  await refused(
    headers,
    {
      entryId: reply!.id,
      kind: 'retry',
      model: { id: 'foo', provider: 'bar' },
    },
    400,
    'Unknown model'
  );
  await refused(
    await signIn(),
    { entryId: reply!.id, kind: 'retry' },
    404,
    'Conversation not found'
  );

  await db.insert(schema.usageEvent).values({
    cacheRead: 0,
    cacheWrite: 0,
    conversationId: id,
    cost: 2,
    createdAt: new Date(),
    input: 0,
    model: 'foo',
    output: 0,
    ownerId: (await conversationOwner(id)) ?? '',
    provider: 'foo',
  });

  env.LAB_MONTHLY_LIMIT = 1;

  try {
    await refused(
      headers,
      { entryId: reply!.id, kind: 'retry' },
      402,
      'You’ve used this month’s $1.00 limit'
    );
  } finally {
    env.LAB_MONTHLY_LIMIT = undefined;
  }

  expect(
    (await call(headers, 'GET', '/conversations')).body.conversations.map(
      ({ id: listed }: { id: number }) => listed
    )
  ).toEqual([id]);
});
