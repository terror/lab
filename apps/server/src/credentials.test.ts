import { schema } from '@lab/db';
import { expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { createCipheriv, randomBytes } from 'node:crypto';

import {
  deriveKey,
  keyring,
  resealSecrets,
  seal,
  unsealWith,
} from './credentials';
import { db } from './db';
import { env } from './env';

test('credentials sealed with an older key open as stale', () => {
  const [foo, bar, baz] = ['foo', 'bar', 'baz'].map((secret) =>
    deriveKey(secret.repeat(11))
  );

  const credential = { key: 'qux', type: 'api_key' as const };

  const sealed = seal(credential, bar!, 'provider:foo');

  expect([
    unsealWith(sealed, 'provider:foo', [bar!]),
    unsealWith(sealed, 'provider:foo', [foo!, bar!]),
    unsealWith(sealed, 'provider:foo', [foo!, baz!]),
  ]).toEqual([
    { stale: false, value: credential },
    { stale: true, value: credential },
    undefined,
  ]);
});

test('new credentials are sealed with the current key, never the previous one', () => {
  const [foo, bar, baz] = ['foo', 'bar', 'baz'].map((secret) =>
    secret.repeat(11)
  );

  const credential = { key: 'qux', type: 'api_key' as const };

  function sealedWith(secrets: Parameters<typeof keyring>[0], secret: string) {
    return unsealWith(
      seal(credential, keyring(secrets).current, 'provider:foo'),
      'provider:foo',
      [deriveKey(secret)]
    );
  }

  expect([
    sealedWith({ BETTER_AUTH_SECRET: foo! }, foo!),
    sealedWith(
      { BETTER_AUTH_SECRET: foo!, LAB_CREDENTIALS_KEY_PREVIOUS: bar! },
      foo!
    ),
    sealedWith(
      {
        BETTER_AUTH_SECRET: foo!,
        LAB_CREDENTIALS_KEY: baz!,
        LAB_CREDENTIALS_KEY_PREVIOUS: bar!,
      },
      baz!
    ),
  ]).toEqual([
    { stale: false, value: credential },
    { stale: false, value: credential },
    { stale: false, value: credential },
  ]);
});

test('a sealed secret opens only for the row it was sealed for', () => {
  const key = deriveKey('foo'.repeat(11));

  const sealed = seal('bar', key, 'connector:1');

  expect([
    unsealWith(sealed, 'connector:1', [key]),
    unsealWith(sealed, 'connector:2', [key]),
    unsealWith(sealed, 'provider:1', [key]),
  ]).toEqual([{ stale: false, value: 'bar' }, undefined, undefined]);
});

function unbound(value: unknown, key: Buffer) {
  const iv = randomBytes(12);

  const cipher = createCipheriv('aes-256-gcm', key, iv);

  const data = Buffer.concat([
    cipher.update(JSON.stringify(value)),
    cipher.final(),
  ]);

  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64');
}

test('stored secrets sealed with an older key or format are resealed with the current key', async () => {
  const older = deriveKey(env.BETTER_AUTH_SECRET);

  const newer = deriveKey(env.LAB_CREDENTIALS_KEY!);

  const credential = { key: 'foo', type: 'api_key' as const };

  await db.insert(schema.user).values({
    createdAt: new Date(),
    email: 'foo@bar.test',
    id: 'foo',
    name: 'foo',
    updatedAt: new Date(),
  });

  const [connector] = await db
    .insert(schema.connector)
    .values({ name: 'foo', ownerId: 'foo', url: 'https://foo.test' })
    .returning();

  await db.insert(schema.providerCredential).values([
    { credential: seal(credential, older, 'provider:foo'), providerId: 'foo' },
    { credential: unbound(credential, newer), providerId: 'bar' },
  ]);

  await db
    .insert(schema.connectorAuth)
    .values({ connectorId: connector!.id, state: unbound(credential, older) });

  await resealSecrets();

  const providers = await db
    .select({
      id: schema.providerCredential.providerId,
      sealed: schema.providerCredential.credential,
    })
    .from(schema.providerCredential)
    .orderBy(schema.providerCredential.providerId);

  const [auth] = await db
    .select({ sealed: schema.connectorAuth.state })
    .from(schema.connectorAuth)
    .where(eq(schema.connectorAuth.connectorId, connector!.id));

  expect([
    ...providers.map(({ id, sealed }) =>
      unsealWith(sealed, `provider:${id}`, [newer])
    ),
    unsealWith(auth!.sealed, `connector:${connector!.id}`, [newer]),
  ]).toEqual([
    { stale: false, value: credential },
    { stale: false, value: credential },
    { stale: false, value: credential },
  ]);
});
