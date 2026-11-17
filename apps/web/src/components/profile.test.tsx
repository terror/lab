import { renderWithQuery, requestUrl, stubFetch } from '@/test/helpers';
import { expect, test } from 'vitest';

import { YourData } from './profile';

const user = {
  createdAt: new Date(0).toISOString(),
  email: 'foo@bar.com',
  emailVerified: true,
  id: 'foo',
  name: 'foo',
  updatedAt: new Date(0).toISOString(),
};

function respond(admin: boolean) {
  return stubFetch(({ pathname }, init) => {
    if (pathname === '/api/auth/get-session') {
      return Response.json({ session: { id: 'bar', userId: 'foo' }, user });
    }

    if (pathname === '/api/profile' && init?.method === 'DELETE') {
      return new Response(null, { status: 204 });
    }

    if (pathname === '/api/profile') {
      return Response.json({ admin });
    }

    return Response.json({
      instructions: '',
      memories: [],
      referenceChats: false,
    });
  });
}

test('people can export their data and delete their account', async () => {
  const fetch = respond(false);

  const { screen } = await renderWithQuery(<YourData />);

  await expect
    .element(screen.getByRole('link', { name: 'Export data' }))
    .toHaveAttribute('href', '/api/profile/export');

  await screen.getByRole('button', { name: 'Delete account' }).click();
  await screen
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Delete account' })
    .click();

  await expect
    .poll(() =>
      fetch.mock.calls.some(
        ([input, init]) =>
          init?.method === 'DELETE' &&
          requestUrl(input).pathname === '/api/profile'
      )
    )
    .toBe(true);
});

test('the admin cannot delete their account', async () => {
  respond(true);

  const { screen } = await renderWithQuery(<YourData />);

  await expect
    .element(screen.getByRole('link', { name: 'Export data' }))
    .toBeVisible();

  await expect
    .poll(() => screen.getByRole('button', { name: 'Delete account' }).query())
    .toBeNull();
});
