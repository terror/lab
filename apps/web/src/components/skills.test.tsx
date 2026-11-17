import { renderWithQuery, requestUrl, stubFetch } from '@/test/helpers';
import { expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';

import { Skills } from './skills';

const skill = {
  createdAt: 0,
  description: 'bar',
  id: 'qux',
  instructions: 'baz',
  name: 'foo',
  updatedAt: 0,
};

test('a new skill is created in a dialog', async () => {
  const fetch = stubFetch((_, init) =>
    Response.json({ skills: init?.method === 'POST' ? [skill] : [] })
  );

  const { screen } = await renderWithQuery(<Skills />);

  await screen.getByRole('button', { name: 'New skill' }).click();
  await screen.getByLabelText('Name').fill('foo');
  await screen.getByLabelText('When to use it').fill('bar');
  await screen.getByLabelText('Instructions').click();
  await userEvent.keyboard('baz');
  await screen.getByRole('button', { name: 'Create' }).click();

  await expect.element(screen.getByText('foo')).toBeVisible();

  const [, init] = fetch.mock.calls.at(-1) ?? [];

  expect({
    body: typeof init?.body === 'string' && JSON.parse(init.body),
    form: screen.getByRole('form', { name: 'Skill' }).query(),
  }).toEqual({
    body: { description: 'bar', instructions: 'baz', name: 'foo' },
    form: null,
  });
});

test('a skill is edited in a dialog', async () => {
  const fetch = stubFetch(() => Response.json({ skills: [skill] }));

  const { screen } = await renderWithQuery(<Skills />);

  await screen.getByRole('button', { name: 'Edit foo' }).click();
  await screen.getByLabelText('Name').fill('quux');
  await screen.getByRole('button', { name: 'Save' }).click();

  await expect
    .element(screen.getByRole('form', { name: 'Skill' }))
    .not.toBeInTheDocument();

  const [input, init] = fetch.mock.calls.at(-1) ?? [];

  expect({
    body: typeof init?.body === 'string' && JSON.parse(init.body),
    method: init?.method,
    path: input && requestUrl(input).pathname,
  }).toEqual({
    body: { description: 'bar', instructions: 'baz', name: 'quux' },
    method: 'PATCH',
    path: '/api/skills/qux',
  });
});
