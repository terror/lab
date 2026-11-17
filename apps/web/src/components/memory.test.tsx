import { renderWithQuery, stubFetch } from '@/test/helpers';
import { expect, test } from 'vitest';

import { Memory } from './memory';

test('a memory is added from a dialog', async () => {
  const memory = { createdAt: 0, id: 'bar', text: 'foo' };

  const fetch = stubFetch((_, init) =>
    Response.json({
      instructions: '',
      memories: init?.method === 'POST' ? [memory] : [],
      referenceChats: false,
    })
  );

  const { screen } = await renderWithQuery(<Memory />);

  await screen.getByRole('button', { name: 'Add memory' }).click();
  await screen.getByRole('textbox', { name: 'Memory' }).fill('foo');
  await screen.getByRole('button', { name: 'Add', exact: true }).click();

  await expect.element(screen.getByText('foo')).toBeVisible();

  await expect
    .element(screen.getByRole('form', { name: 'New memory' }))
    .not.toBeInTheDocument();

  const [, init] = fetch.mock.calls.at(-1) ?? [];

  expect(typeof init?.body === 'string' && JSON.parse(init.body)).toEqual({
    text: 'foo',
  });
});
