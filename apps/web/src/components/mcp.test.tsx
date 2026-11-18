import { fetchedPaths, renderWithQuery, stubFetch } from '@/test/helpers';
import { expect, test } from 'vitest';

import { Mcp } from './mcp';

const apiKey = {
  createdAt: '2026-11-18T12:00:00.000Z',
  id: 'bar',
  lastRequest: null,
  name: 'foo',
  start: 'lab_ba',
};

function sent(fetch: ReturnType<typeof stubFetch>, method: string) {
  const [, init] =
    fetch.mock.calls.find(([, options]) => options?.method === method) ?? [];

  return typeof init?.body === 'string' && JSON.parse(init.body);
}

test('a new key is shown once with the command that connects it', async () => {
  const fetch = stubFetch((_, init) =>
    Response.json(init?.method === 'POST' ? { key: 'lab_baz' } : { keys: [] })
  );

  const { screen } = await renderWithQuery(<Mcp />);

  await screen.getByRole('button', { name: 'Create key' }).click();
  await screen.getByLabelText('Name').fill('foo');
  await screen.getByRole('button', { name: 'Create', exact: true }).click();

  await expect
    .element(
      screen.getByText(
        `claude mcp add --transport http lab ${window.location.origin}/api/mcp --header "Authorization: Bearer lab_baz"`
      )
    )
    .toBeVisible();

  expect(sent(fetch, 'POST')).toEqual({ name: 'foo' });
});

test('a key is revoked from its row', async () => {
  const fetch = stubFetch((_, init) =>
    init?.method === 'DELETE'
      ? new Response(null, { status: 204 })
      : Response.json({ keys: [apiKey] })
  );

  const { screen } = await renderWithQuery(<Mcp />);

  await expect
    .element(screen.getByText('lab_ba… · Created Nov 18, never used'))
    .toBeVisible();

  await screen.getByRole('button', { name: 'Revoke foo' }).click();

  await expect.poll(() => fetchedPaths(fetch)).toContain('/api/mcp/keys/bar');
});
