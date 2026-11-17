import { schema } from '@lab/db';
import { expect, test } from 'bun:test';
import { eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import { signIn, signInAdmin } from '../test/auth';
import { call } from '../test/client';
import app from './app';
import { db } from './db';
import { env } from './env';
import { pruneUploads } from './storage';

async function upload(headers: Headers) {
  const form = new FormData();

  form.append(
    'document',
    new File(['foo'], 'foo.pdf', { type: 'application/pdf' })
  );

  const response = await app.request('/api/uploads', {
    body: form,
    headers,
    method: 'POST',
  });

  return { body: await response.json(), status: response.status };
}

async function uploadId(headers: Headers) {
  return z.object({ id: z.string() }).parse((await upload(headers)).body).id;
}

test('uploads stop at the storage limit for everyone but the admin', async () => {
  env.LAB_STORAGE_LIMIT = 0.000_001;

  try {
    const [user, admin] = [
      await upload(await signIn()),
      await upload(await signInAdmin()),
    ];

    expect({ admin: admin.status, user }).toEqual({
      admin: 201,
      user: {
        body: {
          error:
            'You’ve used your 0.000001 MB of storage. Delete chats with files and empty the Trash to free up space.',
        },
        status: 413,
      },
    });
  } finally {
    env.LAB_STORAGE_LIMIT = undefined;
  }
});

test('concurrent uploads cannot go over the storage limit together', async () => {
  env.LAB_STORAGE_LIMIT = 0.000_005;

  try {
    const headers = await signIn();

    const statuses = await Promise.all([upload(headers), upload(headers)]);

    expect(
      statuses.map(({ status }) => status).toSorted((a, b) => a - b)
    ).toEqual([201, 413]);
  } finally {
    env.LAB_STORAGE_LIMIT = undefined;
  }
});

test('message attachments count toward the storage limit', async () => {
  env.LAB_STORAGE_LIMIT = 0.000_001;

  try {
    expect(
      await call(await signIn(), 'POST', '/conversations', {
        attachments: [
          {
            data: 'Zm9vYmFy',
            mimeType: 'image/png',
            name: 'foo.png',
            type: 'image',
          },
        ],
        content: 'foo',
      })
    ).toEqual({
      body: {
        error:
          'You’ve used your 0.000001 MB of storage. Delete chats with files and empty the Trash to free up space.',
      },
      status: 413,
    });
  } finally {
    env.LAB_STORAGE_LIMIT = undefined;
  }
});

test('old uploads nothing uses are pruned, but recent ones and the picture stay', async () => {
  const headers = await signIn();

  const [old, recent, picture] = await Promise.all([
    uploadId(headers),
    uploadId(headers),
    uploadId(headers),
  ]);

  const [row] = await db
    .select({ ownerId: schema.upload.ownerId })
    .from(schema.upload)
    .where(eq(schema.upload.id, old));

  const ownerId = row?.ownerId ?? '';

  await db
    .update(schema.upload)
    .set({ createdAt: new Date(0) })
    .where(inArray(schema.upload.id, [old, picture]));

  await db
    .update(schema.user)
    .set({ image: `/api/uploads/${picture}` })
    .where(eq(schema.user.id, ownerId));

  await pruneUploads(ownerId);

  expect(
    (
      await db
        .select({ id: schema.upload.id })
        .from(schema.upload)
        .where(eq(schema.upload.ownerId, ownerId))
    )
      .map(({ id }) => id)
      .toSorted()
  ).toEqual([recent, picture].toSorted());
});
