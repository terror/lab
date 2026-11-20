import { fetchedPaths, stubFetch } from '@/test/helpers';
import { pdf } from '@/test/pdf';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

import { DocumentCard } from './document-card';

test('a pdf card shows its first page and opens the pdf', async () => {
  const fetch = stubFetch(() => new Response(pdf(['foo'])));

  const screen = await render(<DocumentCard name='foo.pdf' uploadId='bar' />);

  const thumbnail = screen.container.querySelector('img')?.getAttribute('src');

  await screen.getByRole('button', { name: 'Open foo.pdf' }).click();

  await expect
    .element(screen.getByRole('dialog', { name: 'foo.pdf' }))
    .toBeVisible();

  await expect
    .poll(
      () =>
        screen.getByRole('dialog').element().querySelectorAll('canvas').length,
      { timeout: 5_000 }
    )
    .toBe(1);

  expect(fetchedPaths(fetch)).toEqual(['/api/uploads/bar']);

  expect(thumbnail && new URL(thumbnail).pathname).toBe(
    '/api/uploads/bar/thumbnail'
  );
});
