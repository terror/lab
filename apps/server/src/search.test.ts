import { schema } from '@lab/db';
import { expect, test } from 'bun:test';

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
