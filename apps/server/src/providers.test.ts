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

test('environment variables do not configure providers', async () => {
  const headers = await signIn();

  process.env.GROQ_API_KEY = 'foo';

  try {
    const { body } = await call(headers, 'GET', '/providers');

    const models = await call(headers, 'GET', '/models');

    expect({
      groq: body.providers.find(({ id }: { id: string }) => id === 'groq'),
      models: models.body.models.some(
        ({ provider }: { provider: string }) => provider === 'groq'
      ),
    }).toEqual({
      groq: {
        configured: false,
        id: 'groq',
        methods: ['api_key'],
        name: 'Groq',
      },
      models: false,
    });
  } finally {
    delete process.env.GROQ_API_KEY;
  }
});

test('keys that cannot be decrypted count as disconnected', async () => {
  const headers = await signIn();

  await db
    .insert(schema.providerCredential)
    .values({ credential: 'Zm9v', providerId: 'mistral' });

  try {
    const providers = await call(headers, 'GET', '/providers');

    const models = await call(headers, 'GET', '/models');

    expect({
      mistral: providers.body.providers.find(
        ({ id }: { id: string }) => id === 'mistral'
      ),
      models: models.status,
    }).toEqual({
      mistral: {
        configured: false,
        id: 'mistral',
        methods: ['api_key'],
        name: 'Mistral',
      },
      models: 200,
    });
  } finally {
    await db
      .delete(schema.providerCredential)
      .where(eq(schema.providerCredential.providerId, 'mistral'));
  }
});
