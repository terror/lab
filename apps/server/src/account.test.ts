import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { schema } from '@lab/db';
import { MemoryDoc } from '@lab/harness';
import { expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';

import { signIn, signInAdmin } from '../test/auth';
import { call, chat, settle } from '../test/client';
import app from './app';
import { db } from './db';
import { harness } from './harness';
import { conversationOwner } from './records';

test('users can export their chats and settings', async () => {
  const headers = await signIn();

  const id = await chat(headers, { content: 'foo' });

  await call(headers, 'PATCH', '/memory', { instructions: 'bar' });

  await settle();

  const response = await app.request('/api/profile/export', { headers });

  const { body } = await call(headers, 'GET', '/profile/export');

  expect({
    chats: body.chats.map(
      (exported: {
        id: number;
        messages: { role: string; text: string }[];
      }) => ({
        id: exported.id,
        messages: exported.messages.map(({ role, text }) => [role, text]),
      })
    ),
    disposition: response.headers.get('content-disposition'),
    instructions: body.memory.instructions,
  }).toEqual({
    chats: [
      {
        id,
        messages: [
          ['user', 'foo'],
          ['assistant', 'foo'],
        ],
      },
    ],
    disposition: 'attachment; filename="lab-export.json"',
    instructions: 'bar',
  });
});

test('deleting an account removes its data and signs it out', async () => {
  const headers = await signIn();

  const id = await chat(headers, { content: 'foo' });

  const ownerId = (await conversationOwner(id)) ?? '';

  await call(headers, 'PATCH', '/memory', { instructions: 'bar' });

  const deleted = await call(headers, 'DELETE', '/profile');

  expect({
    after: (await call(headers, 'GET', '/conversations')).status,
    deleted,
    deletions: await db
      .select()
      .from(schema.conversationDeletion)
      .where(eq(schema.conversationDeletion.id, id))
      .then((rows) =>
        rows.map(({ id: chatId, ownerId: owner }) => [chatId, owner])
      ),
    memory: await harness.snapshot(MemoryDoc, ownerId, BACKGROUND_CONTEXT),
    users: await db
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(eq(schema.user.id, ownerId)),
  }).toEqual({
    after: 401,
    deleted: { body: null, status: 204 },
    deletions: [[id, null]],
    memory: undefined,
    users: [],
  });
});

test('the admin account cannot be deleted', async () => {
  expect(await call(await signInAdmin(), 'DELETE', '/profile')).toEqual({
    body: { error: 'The admin account can’t be deleted' },
    status: 403,
  });
});

test('chats purged before deleting an account are still purged from storage', async () => {
  const headers = await signIn();

  const id = await chat(headers, { content: 'foo' });

  await call(headers, 'DELETE', `/conversations/${id}`);
  await call(headers, 'DELETE', `/trash/conversation/${id}`);
  await call(headers, 'DELETE', '/profile');

  expect(
    await db
      .select({ id: schema.conversationDeletion.id })
      .from(schema.conversationDeletion)
      .where(eq(schema.conversationDeletion.id, id))
  ).toEqual([{ id }]);
});
