import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

import { DocumentCard } from './document-card';

test('a pdf card shows its first page and opens the pdf', async () => {
  const screen = await render(<DocumentCard name='foo.pdf' uploadId='bar' />);

  const thumbnail = screen.container.querySelector('img')?.getAttribute('src');

  await screen.getByRole('button', { name: 'Open foo.pdf' }).click();

  await expect
    .element(screen.getByRole('dialog', { name: 'foo.pdf' }))
    .toBeVisible();

  expect(thumbnail && new URL(thumbnail).pathname).toBe(
    '/api/uploads/bar/thumbnail'
  );
});
