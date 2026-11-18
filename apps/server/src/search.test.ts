import { schema } from '@lab/db';
import { expect, test } from 'bun:test';
import { and, eq } from 'drizzle-orm';

import { signIn } from '../test/auth';
import { call, chat, settle } from '../test/client';
import { db } from './db';
import { conversationOwner } from './records';

test('workspace search finds chats, projects, and scheduled tasks', async () => {
  const headers = await signIn();

  const titled = await chat(headers, { content: 'foo' });

  await call(headers, 'PATCH', `/conversations/${titled}`, {
    title: 'Lisbon foo',
  });

  const mentioned = await chat(headers, { content: 'bar lisbon baz' });

  const { body } = await call(headers, 'POST', '/projects', {
    name: 'Lisbon qux',
  });

  await db.insert(schema.scheduledTask).values({
    cron: '0 8 * * 5',
    description: 'Fridays',
    ownerId: (await conversationOwner(titled)) ?? '',
    prompt: 'foo',
    timezone: 'UTC',
    title: 'Lisbon weather',
  });

  await settle();

  const { body: results } = await call(headers, 'GET', '/search?q=lisbon');

  expect({
    chats: results.chats.map(
      ({ id, snippet }: { id: number; snippet: unknown }) => [id, snippet]
    ),
    files: results.files,
    projects: results.projects,
    schedules: results.schedules.map(({ title }: { title: string }) => title),
  }).toEqual({
    chats: [
      [titled, null],
      [
        mentioned,
        [
          { match: false, text: 'bar ' },
          { match: true, text: 'lisbon' },
          { match: false, text: ' baz' },
        ],
      ],
    ],
    files: [],
    projects: [{ chats: 0, id: body.project.id, name: 'Lisbon qux' }],
    schedules: ['Lisbon weather'],
  });
});

test('message matches report when they were sent in any server timezone', async () => {
  const zone = process.env.TZ;

  process.env.TZ = 'America/New_York';

  try {
    const headers = await signIn();

    const id = await chat(headers, { content: 'foo qux' });

    const [message] = await db
      .select({ createdAt: schema.messageText.createdAt })
      .from(schema.messageText)
      .where(
        and(
          eq(schema.messageText.conversationId, id),
          eq(schema.messageText.role, 'user')
        )
      );

    const { body } = await call(headers, 'GET', '/search?q=qux');

    expect(
      body.chats.map(
        ({ id: chatId, updatedAt }: { id: number; updatedAt: string }) => [
          chatId,
          updatedAt,
        ]
      )
    ).toEqual([[id, message?.createdAt.toISOString()]]);
  } finally {
    if (zone === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = zone;
    }
  }
});

test('searches ignore null characters', async () => {
  const headers = await signIn();

  const id = await chat(headers, { content: 'foo' });

  await call(headers, 'PATCH', `/conversations/${id}`, { title: 'bar' });

  await settle();

  const found = await Promise.all(
    [
      '/conversations?search=b%00ar',
      '/library?search=b%00ar',
      '/search?q=b%00ar',
    ].map((path) => call(headers, 'GET', path))
  );

  expect(
    found.map(({ body, status }) => ({
      ids: (body.conversations ?? body.chats ?? body.items)?.map(
        (item: { id: number }) => item.id
      ),
      status,
    }))
  ).toEqual([
    { ids: [id], status: 200 },
    { ids: [], status: 200 },
    { ids: [id], status: 200 },
  ]);
});
