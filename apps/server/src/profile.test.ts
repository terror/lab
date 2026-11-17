import { expect, test } from 'bun:test';

import { signIn } from '../test/auth';
import { call } from '../test/client';
import app from './app';

async function setPicture(headers: Headers, picture: File) {
  const form = new FormData();

  form.set('picture', picture);

  const response = await app.request('/api/profile/picture', {
    body: form,
    headers,
    method: 'PUT',
  });

  return { body: await response.json(), status: response.status };
}

async function image(headers: Headers) {
  const { body } = await call(headers, 'GET', '/auth/get-session');

  return body.user.image;
}

test('a profile picture can be uploaded and removed', async () => {
  const headers = await signIn();

  const rejected = await setPicture(
    headers,
    new File(['foo'], 'foo.txt', { type: 'text/plain' })
  );

  const set = await setPicture(
    headers,
    new File(['bar'], 'bar.png', { type: 'image/png' })
  );

  const shown = await image(headers);

  await call(headers, 'DELETE', '/profile/picture');

  expect({ rejected, removed: await image(headers), set, shown }).toEqual({
    rejected: {
      body: {
        error:
          '✖ Choose a PNG, JPEG, GIF, or WebP image up to 5 MB\n  → at picture',
      },
      status: 400,
    },
    removed: null,
    set: { body: { image: shown }, status: 200 },
    shown: set.body.image,
  });
});
