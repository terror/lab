import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { schema } from '@lab/db';
import { MemoryDoc } from '@lab/harness';
import { expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';

import { signIn, signInAdmin } from '../test/auth';
import { artifactChat, call, chat, settle } from '../test/client';
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

test('users can export their artifacts, files and usage', async () => {
  const headers = await signIn();

  const id = await artifactChat(headers);

  const artifact = `/conversations/${id}/artifacts/bar`;

  await call(headers, 'PUT', `${artifact}/state?key=foo`, { value: 'baz' });
  await call(headers, 'PUT', `${artifact}/pin`, { projectId: null });
  await call(headers, 'PUT', '/usage/budget', { limit: 2 });

  const attached = await chat(headers, {
    attachments: [{ name: 'qux.txt', text: 'quux', type: 'file' }],
    content: 'foo',
  });

  const form = new FormData();

  form.set('picture', new File(['corge'], 'corge.png', { type: 'image/png' }));

  await app.request('/api/profile/picture', {
    body: form,
    headers,
    method: 'PUT',
  });

  await settle();

  const { body } = await call(headers, 'GET', '/profile/export');

  expect({
    library: body.library.map(
      ({
        conversationId,
        kind,
        mimeType,
        name,
        size,
      }: Record<string, unknown>) => ({
        conversationId,
        kind,
        mimeType,
        name,
        size,
      })
    ),
    limit: body.usage.monthlyLimit,
    pins: body.artifacts.pins.map(
      ({ artifactId, conversationId, projectId }: Record<string, unknown>) => ({
        artifactId,
        conversationId,
        projectId,
      })
    ),
    state: body.artifacts.state,
    uploads: body.uploads.map(
      ({ mimeType, size }: Record<string, unknown>) => ({ mimeType, size })
    ),
    usage: body.usage.events
      .map(
        ({ conversationId, kind }: { conversationId: number; kind: string }) =>
          `${conversationId} ${kind}`
      )
      .toSorted(),
  }).toEqual({
    library: [
      {
        conversationId: attached,
        kind: 'file',
        mimeType: 'text/plain',
        name: 'qux.txt',
        size: 4,
      },
    ],
    limit: 2,
    pins: [{ artifactId: 'bar', conversationId: id, projectId: null }],
    state: [
      { artifactId: 'bar', conversationId: id, key: 'foo', value: 'baz' },
    ],
    uploads: [{ mimeType: 'image/png', size: 5 }],
    usage: [
      `${attached} response`,
      `${attached} title`,
      `${id} response`,
      `${id} response`,
      `${id} title`,
    ].toSorted(),
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
