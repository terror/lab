import { schema } from '@lab/db';
import { decryptOAuthToken } from 'better-auth/oauth2';
import { expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';

import { signIn } from '../test/auth';
import { call, create } from '../test/client';
import app from './app';
import { allowed, auth, emailAllowed, sealOAuthTokens } from './auth';
import { db } from './db';
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

test('changes from other sites are rejected', async () => {
  const headers = await signIn();

  const id = await create(headers);

  async function sent(from: Record<string, string>) {
    const response = await app.request(`/api/conversations/${id}/read`, {
      headers: { ...Object.fromEntries(headers), ...from },
      method: 'POST',
    });

    return [response.status, await response.text()];
  }

  const rejected = [403, '{"error":"This request came from another site"}'];

  expect({
    app: await sent({
      origin: env.LAB_ORIGIN,
      'sec-fetch-site': 'same-origin',
    }),
    crossSite: await sent({
      origin: 'https://foo.example',
      'sec-fetch-site': 'cross-site',
    }),
    native: await sent({}),
    opaque: await sent({ origin: 'null' }),
    sameSite: await sent({ 'sec-fetch-site': 'same-site' }),
  }).toEqual({
    app: [204, ''],
    crossSite: rejected,
    native: [204, ''],
    opaque: rejected,
    sameSite: rejected,
  });
});

test('pages on other sites cannot open the authorization proxy', async () => {
  const started = await app.request('/api/auth/sign-in/social', {
    body: JSON.stringify({ callbackURL: '/', provider: 'google' }),
    headers: { 'content-type': 'application/json', origin: env.LAB_ORIGIN },
    method: 'POST',
  });

  const { url } = (await started.json()) as { url: string };

  const open = async (site: string) => {
    const response = await app.request(
      `/api/auth/expo-authorization-proxy?authorizationURL=${encodeURIComponent(url)}`,
      { headers: { 'sec-fetch-site': site } }
    );

    return response.status;
  };

  expect([
    await open('cross-site'),
    await open('same-site'),
    await open('none'),
  ]).toEqual([403, 403, 302]);
});

test('google tokens are stored encrypted, including ones saved before', async () => {
  const headers = await signIn();

  const session = await auth.api.getSession({ headers });

  const table = schema.account;

  await db.insert(table).values({
    accessToken: 'foo',
    accessTokenExpiresAt: new Date(Date.now() + 3_600_000),
    accountId: 'bar',
    createdAt: new Date(),
    id: 'baz',
    providerId: 'google',
    refreshToken: 'qux',
    updatedAt: new Date(),
    userId: session?.user.id ?? '',
  });

  const stored = async () => {
    const [row] = await db
      .select({
        accessToken: table.accessToken,
        refreshToken: table.refreshToken,
      })
      .from(table)
      .where(eq(table.id, 'baz'));

    return row;
  };

  await sealOAuthTokens();

  const sealed = await stored();

  await sealOAuthTokens();

  const { accessToken } = await auth.api.getAccessToken({
    body: { accountId: 'baz' },
    headers,
  });

  const envelope = expect.stringMatching(/^(?:[0-9a-f]{2})+$/);

  expect({
    accessToken,
    again: await stored(),
    refreshToken: await decryptOAuthToken(
      sealed?.refreshToken ?? '',
      await auth.$context
    ),
    sealed,
  }).toEqual({
    accessToken: 'foo',
    again: sealed,
    refreshToken: 'qux',
    sealed: { accessToken: envelope, refreshToken: envelope },
  });
});
