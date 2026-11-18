import { expect, test } from 'bun:test';

import { deriveKey, keyring, seal, unsealWith } from './credentials';

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
