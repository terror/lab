import { schema } from '@lab/db';
import { expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';

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

  const sealed = seal(credential, bar!);

  expect([
    unsealWith(sealed, [bar!]),
    unsealWith(sealed, [foo!, bar!]),
    unsealWith(sealed, [foo!, baz!]),
  ]).toEqual([
    { credential, stale: false },
    { credential, stale: true },
    undefined,
  ]);
});

test('new credentials are sealed with the current key, never the previous one', () => {
  const [foo, bar, baz] = ['foo', 'bar', 'baz'].map((secret) =>
    secret.repeat(11)
  );

  const credential = { key: 'qux', type: 'api_key' as const };

  function sealedWith(secrets: Parameters<typeof keyring>[0], secret: string) {
    return unsealWith(seal(credential, keyring(secrets).current), [
      deriveKey(secret),
    ]);
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
    { credential, stale: false },
    { credential, stale: false },
    { credential, stale: false },
  ]);
});

test('stored secrets sealed with an older key are resealed with the current key', async () => {
  const older = deriveKey(env.BETTER_AUTH_SECRET);

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

  await db
    .insert(schema.providerCredential)
    .values({ credential: seal(credential, older), providerId: 'foo' });

  await db
    .insert(schema.connectorAuth)
    .values({ connectorId: connector!.id, state: seal(credential, older) });

  await resealSecrets();

  const [provider] = await db
    .select({ sealed: schema.providerCredential.credential })
    .from(schema.providerCredential)
    .where(eq(schema.providerCredential.providerId, 'foo'));

  const [auth] = await db
    .select({ sealed: schema.connectorAuth.state })
    .from(schema.connectorAuth)
    .where(eq(schema.connectorAuth.connectorId, connector!.id));

  expect(
    [provider!, auth!].map(({ sealed }) =>
      unsealWith(sealed, [deriveKey(env.LAB_CREDENTIALS_KEY!)])
    )
  ).toEqual([
    { credential, stale: false },
    { credential, stale: false },
  ]);
});
