import { schema } from '@lab/db';
import { expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';

import { signIn } from '../test/auth';
import { call } from '../test/client';
import { db } from './db';

test('provider keys can be added and removed', async () => {
  const headers = await signIn();

  async function groq() {
    const { body } = await call(headers, 'GET', '/providers');

    const models = await call(headers, 'GET', '/models');

    return {
      models: models.body.models.some(
        ({ provider }: { provider: string }) => provider === 'groq'
      ),
      provider: body.providers.find(({ id }: { id: string }) => id === 'groq'),
    };
  }

  expect(await groq()).toEqual({
    models: false,
    provider: {
      configured: false,
      id: 'groq',
      methods: ['api_key'],
      name: 'Groq',
      stored: false,
    },
  });

  expect(
    await call(headers, 'PUT', '/providers/groq', {
      apiKey: 'foo-bar-baz',
      method: 'api_key',
    })
  ).toEqual({ body: null, status: 204 });

  expect(await groq()).toEqual({
    models: true,
    provider: {
      configured: true,
      id: 'groq',
      methods: ['api_key'],
      name: 'Groq',
      stored: true,
    },
  });

  const [row] = await db
    .select()
    .from(schema.providerCredential)
    .where(eq(schema.providerCredential.providerId, 'groq'));

  expect(row?.credential.includes('foo-bar-baz')).toBe(false);

  expect(await call(headers, 'DELETE', '/providers/groq')).toEqual({
    body: null,
    status: 204,
  });

  expect(await groq()).toEqual({
    models: false,
    provider: {
      configured: false,
      id: 'groq',
      methods: ['api_key'],
      name: 'Groq',
      stored: false,
    },
  });
});

test('unknown providers are rejected', async () => {
  expect(
    await call(await signIn(), 'PUT', '/providers/foo', {
      apiKey: 'bar',
      method: 'api_key',
    })
  ).toEqual({ body: { error: 'Provider not found' }, status: 404 });
});
