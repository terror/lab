import { expect, test } from 'bun:test';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { site } from './site';

test('a missing asset is not found instead of the app', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lab-'));

  await writeFile(join(root, 'index.html'), 'foo');

  const response = await site(root).request('/assets/bar.js');

  expect({
    cache: response.headers.get('cache-control'),
    status: response.status,
  }).toEqual({ cache: null, status: 404 });
});
