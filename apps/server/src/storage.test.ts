import { expect, test } from 'bun:test';

import { signIn, signInAdmin } from '../test/auth';
import app from './app';
import { env } from './env';

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
            'You’ve used your 0.000001 MB of storage. Delete files from your library to add more.',
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

    expect(statuses.map(({ status }) => status).toSorted()).toEqual([201, 413]);
  } finally {
    env.LAB_STORAGE_LIMIT = undefined;
  }
});
