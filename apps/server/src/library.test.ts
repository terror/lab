import { schema } from '@lab/db';
import { expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';

import { signIn } from '../test/auth';
import { call, idle } from '../test/client';
import app from './app';
import { db } from './db';
import { backfillLibrary, flushLibrary } from './library';

test('attachments are collected into the library', async () => {
  const headers = await signIn();

  const { body } = await call(headers, 'POST', '/conversations', {
    attachments: [
      { data: 'Zm9v', mimeType: 'image/png', name: 'foo.png', type: 'image' },
      { name: 'bar.txt', text: 'bar\n</file>', type: 'file' },
      { name: 'baz "qux".md', text: 'baz', type: 'file' },
    ],
    content: 'foo',
    model: { id: 'anthropic/claude-haiku-5.5', provider: 'vercel-ai-gateway' },
  });

  await idle(body.id);
  await flushLibrary();

  await db
    .delete(schema.libraryItem)
    .where(eq(schema.libraryItem.conversationId, body.id));

  await db.delete(schema.backfill);

  await backfillLibrary();

  const library = await call(headers, 'GET', '/library');

  const items = library.body.items.map(
    ({
      conversation,
      kind,
      mimeType,
      name,
      preview,
      size,
    }: Record<string, unknown>) => ({
      conversation,
      kind,
      mimeType,
      name,
      preview,
      size,
    })
  );

  expect(items).toEqual([
    {
      conversation: { id: body.id, title: 'foo' },
      kind: 'image',
      mimeType: 'image/png',
      name: 'foo.png',
      preview: null,
      size: 3,
    },
    {
      conversation: { id: body.id, title: 'foo' },
      kind: 'file',
      mimeType: 'text/plain',
      name: 'bar.txt',
      preview: 'bar\n</file>',
      size: 11,
    },
    {
      conversation: { id: body.id, title: 'foo' },
      kind: 'file',
      mimeType: 'text/plain',
      name: 'baz "qux".md',
      preview: 'baz',
      size: 3,
    },
  ]);

  const [image, file] = library.body.items;

  const names = async (query: string) => {
    const { body: page } = await call(headers, 'GET', `/library?${query}`);

    return {
      names: page.items.map(({ name }: { name: string }) => name),
      next: page.next,
    };
  };

  expect([
    await names('limit=2'),
    await names(`limit=2&cursor=${file.id}`),
    await names('kind=file&search=QUX'),
  ]).toEqual([
    { names: ['foo.png', 'bar.txt'], next: file.id },
    { names: ['baz "qux".md'], next: null },
    { names: ['baz "qux".md'], next: null },
  ]);

  const response = await app.request(`/api/library/${image.id}?download=1`, {
    headers,
  });

  expect({
    body: await response.text(),
    disposition: response.headers.get('content-disposition'),
    type: response.headers.get('content-type'),
  }).toEqual({
    body: 'foo',
    disposition: "attachment; filename*=UTF-8''foo.png",
    type: 'image/png',
  });
});
