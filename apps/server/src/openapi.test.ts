import { expect, test } from 'bun:test';

import { signIn } from '../test/auth';
import { call, raw } from '../test/client';

test('the api is described with openapi', async () => {
  const headers = await signIn();

  const { body } = await call(headers, 'GET', '/openapi.json');

  const anonymous = await raw(new Headers(), '/openapi.json');

  expect({
    anonymous: anonymous.status,
    memory:
      body.paths['/api/memory'].post.requestBody.content['application/json']
        .schema,
    tags: body.tags.map(({ name }: { name: string }) => name),
    title: body.info.title,
  }).toEqual({
    anonymous: 401,
    memory: {
      properties: { text: { maxLength: 500, minLength: 1, type: 'string' } },
      required: ['text'],
      type: 'object',
    },
    tags: [
      'Changelog',
      'Computer',
      'Conversations',
      'Health',
      'Library',
      'Memory',
      'Models',
      'Preferences',
      'Projects',
      'Providers',
      'Schedules',
      'Skills',
      'Trash',
      'Uploads',
      'Usage',
      'Version',
    ],
    title: 'Lab API',
  });
});
