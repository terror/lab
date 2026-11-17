import { expect, test } from 'bun:test';

import { signIn } from '../test/auth';
import { call } from '../test/client';
import { allowed, emailAllowed } from './auth';
import { env } from './env';

test('allowed emails match exactly, by domain, or with a wildcard', () => {
  expect([
    emailAllowed('foo@bar.com', []),
    emailAllowed('foo@bar.com', ['*']),
    emailAllowed('FOO@bar.com', ['foo@bar.com']),
    emailAllowed('foo@bar.com', ['*@bar.com']),
    emailAllowed('foo@bazbar.com', ['*@bar.com']),
    emailAllowed('foo@baz.bar.com', ['*@bar.com']),
    emailAllowed('bar@bar.com', ['foo@bar.com']),
  ]).toEqual([false, true, true, true, false, false, false]);
});

test('accounts without a verified email are not allowed', async () => {
  expect(
    await call(await signIn({ emailVerified: false }), 'GET', '/conversations')
  ).toEqual({
    body: { error: 'This account is not allowed to use Lab.' },
    status: 403,
  });
});

test('the admin email still needs to be verified', () => {
  expect([
    allowed({ email: env.LAB_ADMIN_EMAIL, emailVerified: true }),
    allowed({ email: env.LAB_ADMIN_EMAIL, emailVerified: false }),
  ]).toEqual([true, false]);
});
