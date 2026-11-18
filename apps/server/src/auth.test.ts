import { expect, test } from 'bun:test';

import { signIn } from '../test/auth';
import { call, create } from '../test/client';
import app from './app';
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
