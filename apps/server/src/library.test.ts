import { schema } from '@lab/db';
import { expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';

import { signIn } from '../test/auth';
import { call, idle, raw, settle } from '../test/client';
import { db } from './db';
import { backfillLibrary } from './library';

type Item = Record<string, unknown> & { id: number; name: string };

function contents(items: Item[]) {
  return items.map(({ conversation, kind, mimeType, name, preview, size }) => ({
    conversation,
    kind,
    mimeType,
    name,
    preview,
    size,
  }));
}

test('attachments are collected into the library', async () => {
  const headers = await signIn();

  const { body } = await call(headers, 'POST', '/conversations', {
    attachments: [
      { data: 'Zm9v', mimeType: 'image/png', name: 'foo.png', type: 'image' },
      { name: 'bar.txt', text: 'bar', type: 'file' },
      { name: 'baz "qux".md', text: 'baz', type: 'file' },
    ],
    content: 'foo',
    model: { id: 'anthropic/claude-haiku-5.5', provider: 'vercel-ai-gateway' },
  });

  await idle(body.id);
  await settle();

  const recorded = await call(headers, 'GET', '/library');

  await db
    .delete(schema.libraryItem)
    .where(eq(schema.libraryItem.conversationId, body.id));

  await backfillLibrary();

  const library = await call(headers, 'GET', '/library');

  const conversation = { id: body.id, title: 'foo' };

  expect([contents(recorded.body.items), contents(library.body.items)]).toEqual(
    Array.from({ length: 2 }, () => [
      {
        conversation,
        kind: 'image',
        mimeType: 'image/png',
        name: 'foo.png',
        preview: null,
        size: 3,
      },
      {
        conversation,
        kind: 'file',
        mimeType: 'text/plain',
        name: 'bar.txt',
        preview: 'bar',
        size: 3,
      },
      {
        conversation,
        kind: 'file',
        mimeType: 'text/plain',
        name: 'baz "qux".md',
        preview: 'baz',
        size: 3,
      },
    ])
  );

  const page = async (query: string) => {
    const { body: result } = await call(headers, 'GET', `/library?${query}`);

    return {
      names: result.items.map(({ name }: Item) => name),
      next: result.next,
    };
  };

  const first = await page('limit=2');

  expect([
    first.names,
    await page(`limit=2&cursor=${first.next}`),
    await page('kind=file&search=QUX'),
  ]).toEqual([
    ['foo.png', 'bar.txt'],
    { names: ['baz "qux".md'], next: null },
    { names: ['baz "qux".md'], next: null },
  ]);

  const [image] = library.body.items;

  const response = await raw(headers, `/library/${image.id}?download=1`);

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

test('text extracted from a PDF downloads as a text file', async () => {
  const headers = await signIn();

  const { body } = await call(headers, 'POST', '/conversations', {
    attachments: [{ name: 'foo.pdf', text: 'bar', type: 'file' }],
    content: 'baz',
  });

  await idle(body.id);
  await settle();

  const library = await call(headers, 'GET', '/library?search=foo.pdf');

  const [item] = library.body.items;

  const response = await raw(headers, `/library/${item.id}?download=1`);

  expect({
    body: await response.text(),
    disposition: response.headers.get('content-disposition'),
  }).toEqual({
    body: 'bar',
    disposition: "attachment; filename*=UTF-8''foo.pdf.txt",
  });
});

test('the library backfill resumes from its checkpoint', async () => {
  const headers = await signIn();

  const { body } = await call(headers, 'POST', '/conversations', {
    attachments: [{ name: 'foo.txt', text: 'bar', type: 'file' }],
    content: 'baz',
  });

  await idle(body.id);
  await settle();

  const remove = () =>
    db
      .delete(schema.libraryItem)
      .where(eq(schema.libraryItem.conversationId, body.id));

  const count = async () =>
    (
      await db
        .select({ id: schema.libraryItem.id })
        .from(schema.libraryItem)
        .where(eq(schema.libraryItem.conversationId, body.id))
    ).length;

  await remove();
  await backfillLibrary();

  const first = await count();

  await remove();
  await backfillLibrary();

  expect([first, await count()]).toEqual([1, 0]);
});
