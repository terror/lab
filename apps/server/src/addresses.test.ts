import { expect, test } from 'bun:test';

import { isPrivateAddress } from './addresses';

test('private network addresses are recognized', () => {
  const addresses = [
    '8.8.8.8',
    '10.0.0.1',
    '100.64.0.1',
    '127.0.0.1',
    '169.254.169.254',
    '172.16.0.1',
    '192.168.1.1',
    '0.0.0.0',
    '2606:4700::1111',
    '::1',
    '::ffff:127.0.0.1',
    'fd00::1',
    'fe80::1',
  ];

  expect(
    Object.fromEntries(
      addresses.map((address) => [address, isPrivateAddress(address)])
    )
  ).toEqual({
    '0.0.0.0': true,
    '10.0.0.1': true,
    '100.64.0.1': true,
    '127.0.0.1': true,
    '169.254.169.254': true,
    '172.16.0.1': true,
    '192.168.1.1': true,
    '2606:4700::1111': false,
    '8.8.8.8': false,
    '::1': true,
    '::ffff:127.0.0.1': true,
    'fd00::1': true,
    'fe80::1': true,
  });
});
