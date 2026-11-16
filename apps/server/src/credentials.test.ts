import { expect, test } from 'bun:test';

import { deriveKey, seal, unsealWith } from './credentials';

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
