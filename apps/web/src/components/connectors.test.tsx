import { renderWithQuery, requestUrl, stubFetch } from '@/test/helpers';
import { expect, test } from 'vitest';

import { Connectors } from './connectors';

const connector = {
  enabled: true,
  error: null,
  id: 1,
  name: 'foo',
  status: 'connected',
  tools: [
    { description: 'baz', name: 'bar' },
    { description: 'qux', name: 'quux' },
  ],
  url: 'https://foo.com/mcp',
};

test('a connector is added by its URL and lists its tools', async () => {
  const fetch = stubFetch((_, init) =>
    Response.json({
      connectors: init?.method === 'POST' ? [connector] : [],
    })
  );

  const { screen } = await renderWithQuery(<Connectors />);

  await screen.getByRole('button', { name: 'Add connector' }).click();
  await screen.getByLabelText('Name').fill('foo');
  await screen.getByLabelText('URL').fill('https://foo.com/mcp');
  await screen.getByRole('button', { name: 'Add' }).click();

  await screen.getByRole('button', { name: '2 tools' }).click();

  await expect.element(screen.getByText('quux')).toBeVisible();

  const [, init] = fetch.mock.calls.at(-1) ?? [];

  expect(typeof init?.body === 'string' && JSON.parse(init.body)).toEqual({
    name: 'foo',
    url: 'https://foo.com/mcp',
  });
});

test('a connector that cannot connect says why', async () => {
  stubFetch(() =>
    Response.json({
      connectors: [{ ...connector, error: 'bar', status: 'error', tools: [] }],
    })
  );

  const { screen } = await renderWithQuery(<Connectors />);

  await expect.element(screen.getByText('bar')).toBeVisible();
});

test('a connector that needs sign-in links to signing in', async () => {
  stubFetch(() =>
    Response.json({
      connectors: [{ ...connector, status: 'unauthorized', tools: [] }],
    })
  );

  const { screen } = await renderWithQuery(<Connectors />);

  await expect
    .element(screen.getByRole('link', { name: 'Sign in' }))
    .toHaveAttribute('href', '/api/connectors/1/authorize');
});

test('deleting a connector asks first', async () => {
  const fetch = stubFetch(() => Response.json({ connectors: [connector] }));

  const { screen } = await renderWithQuery(<Connectors />);

  await screen.getByRole('button', { name: 'Options for foo' }).click();
  await screen.getByRole('menuitem', { name: 'Delete' }).click();
  await screen
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Delete' })
    .click();

  await expect
    .poll(() =>
      fetch.mock.calls.flatMap(([input, init]) =>
        init?.method === 'DELETE' ? [requestUrl(input).pathname] : []
      )
    )
    .toEqual(['/api/connectors/1']);
});
