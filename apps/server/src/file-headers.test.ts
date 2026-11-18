import { schema } from '@lab/db';
import { expect, test } from 'bun:test';

import { signIn } from '../test/auth';
import { create, raw } from '../test/client';
import { db } from './db';
import { conversationOwner } from './records';

async function served(headers: Headers, ownerId: string, mimeType: string) {
  const [row] = await db
    .insert(schema.upload)
    .values({ content: new Uint8Array([1]), mimeType, ownerId })
    .returning({ id: schema.upload.id });

  const response = await raw(headers, `/uploads/${row?.id}`);

  return [
    response.headers.get('content-type'),
    response.headers.get('content-security-policy'),
  ];
}

test('user files are sandboxed except pdfs', async () => {
  const headers = await signIn();

  const ownerId = (await conversationOwner(await create(headers))) ?? '';

  expect({
    html: await served(headers, ownerId, 'text/html'),
    svg: await served(headers, ownerId, 'image/svg+xml'),
  }).toEqual({
    html: [
      'text/html',
      "sandbox; default-src 'none'; img-src data:; media-src data:; style-src 'unsafe-inline'",
    ],
    svg: [
      'image/svg+xml',
      "sandbox; default-src 'none'; img-src data:; media-src data:; style-src 'unsafe-inline'",
    ],
  });

  const [, pdfPolicy] = await served(headers, ownerId, 'application/pdf');

  expect(pdfPolicy?.startsWith('sandbox')).toBe(false);
});

test('user files are cached per session', async () => {
  const headers = await signIn();

  const ownerId = (await conversationOwner(await create(headers))) ?? '';

  const [row] = await db
    .insert(schema.upload)
    .values({ content: new Uint8Array([1]), mimeType: 'image/png', ownerId })
    .returning({ id: schema.upload.id });

  const response = await raw(headers, `/uploads/${row?.id}`);

  expect([
    response.headers.get('cache-control'),
    response.headers.get('vary'),
  ]).toEqual(['private, max-age=31536000, immutable', 'cookie']);
});
