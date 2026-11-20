import { renderWithQuery, requestUrl, stubFetch } from '@/test/helpers';
import { assert, expect, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';

import { Profile, YourData } from './profile';

const user = {
  createdAt: new Date(0).toISOString(),
  email: 'foo@bar.com',
  emailVerified: true,
  id: 'foo',
  name: 'foo',
  updatedAt: new Date(0).toISOString(),
};

vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  useUser: () => ({ ...user, image: '/foo.png' }),
}));

function respond(
  admin: boolean,
  picture = Promise.resolve(Response.json({ image: '/bar.png' }))
) {
  return stubFetch(({ pathname }, init) => {
    if (pathname === '/api/auth/get-session') {
      return Response.json({ session: { id: 'bar', userId: 'foo' }, user });
    }

    if (init?.method === 'DELETE') {
      return new Response(null, { status: 204 });
    }

    if (pathname === '/api/profile/picture' && init?.method === 'PUT') {
      return picture;
    }

    if (pathname === '/api/profile') {
      return Response.json({ admin });
    }

    if (init?.method === 'PATCH' && typeof init.body === 'string') {
      return Response.json({
        instructions: JSON.parse(init.body).instructions,
        memories: [],
        referenceChats: false,
      });
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

test('removing the profile picture asks first', async () => {
  const fetch = respond(false);

  const { screen } = await renderWithQuery(<Profile />);

  await screen.getByRole('button', { name: 'Edit profile picture' }).click();
  await screen.getByRole('menuitem', { name: 'Remove picture' }).click();
  await screen
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Remove' })
    .click();

  await expect
    .poll(() =>
      fetch.mock.calls.flatMap(([input, init]) =>
        init?.method === 'DELETE' ? [requestUrl(input).pathname] : []
      )
    )
    .toEqual(['/api/profile/picture']);
});

test('the picture menu opens by keyboard and shows an upload in progress', async () => {
  const picture = Promise.withResolvers<Response>();
  const fetch = respond(false, picture.promise);
  const choose = vi.spyOn(HTMLInputElement.prototype, 'click');

  const { screen } = await renderWithQuery(<Profile />);

  const edit = screen.getByRole('button', { name: 'Edit profile picture' });

  edit.element().focus();

  await userEvent.keyboard('{Enter}');

  await expect
    .element(screen.getByRole('menuitem', { name: 'Change picture' }))
    .toHaveFocus();

  await userEvent.keyboard('{Enter}');

  expect(choose).toHaveBeenCalledOnce();

  const input = screen.getByLabelText('Upload picture');

  await input.upload(new File(['bar'], 'foo.png', { type: 'image/png' }));

  await expect.element(edit).toBeDisabled();
  await expect.element(edit).toHaveAttribute('aria-busy', 'true');
  await expect.element(input).toHaveValue('');

  const call = fetch.mock.calls.find(([, init]) => init?.method === 'PUT');

  assert(call);

  const [url, init] = call;

  assert(init?.body instanceof FormData);

  const file = init.body.get('picture');

  assert(file instanceof File);

  expect([
    requestUrl(url).pathname,
    file.name,
    file.type,
    await file.text(),
  ]).toEqual(['/api/profile/picture', 'foo.png', 'image/png', 'bar']);

  picture.resolve(Response.json({ image: '/bar.png' }));

  await expect.element(edit).toBeEnabled();
  await expect.element(edit).toHaveAttribute('aria-busy', 'false');
});

test('instructions offer Save once edited and say when they are saved', async () => {
  respond(false);

  const { screen } = await renderWithQuery(<Profile />);

  const field = screen.getByRole('textbox', { name: 'Custom instructions' });
  const save = screen.getByRole('button', { name: 'Save' });

  await expect.element(field).toBeVisible();
  expect(save.query()).toBeNull();

  await field.fill('foo');
  await save.click();

  await expect
    .poll(() => screen.getByRole('status').element().textContent)
    .toBe('Saved');
  await expect.element(field).toHaveValue('foo');
  expect(save.query()).toBeNull();

  await field.fill('bar');

  await expect
    .poll(() => screen.getByRole('status').element().textContent)
    .toBe('');
  await expect.element(save).toBeEnabled();
});
