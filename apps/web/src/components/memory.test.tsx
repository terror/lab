import { Toaster } from '@/components/ui/sonner';
import { renderWithQuery, requestUrl, stubFetch } from '@/test/helpers';
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

test('a deleted memory comes back with Undo', async () => {
  const memory = { createdAt: 0, id: 'bar', text: 'foo' };

  const fetch = stubFetch((_, init) =>
    Response.json({
      instructions: '',
      memories: init?.method === 'DELETE' ? [] : [memory],
      referenceChats: false,
    })
  );

  const { screen } = await renderWithQuery(
    <>
      <Memory />
      <Toaster />
    </>
  );

  await screen.getByRole('button', { name: 'Delete foo' }).click();
  await screen.getByRole('button', { name: 'Undo' }).click();

  await expect
    .poll(() =>
      fetch.mock.calls.flatMap(([input, init]) =>
        init?.method === 'DELETE' || init?.method === 'POST'
          ? [[init.method, requestUrl(input).pathname, init.body]]
          : []
      )
    )
    .toEqual([
      ['DELETE', '/api/memory/bar', undefined],
      ['POST', '/api/memory', JSON.stringify({ text: 'foo' })],
    ]);
});
