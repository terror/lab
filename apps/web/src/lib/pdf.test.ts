import { pdf } from '@/test/pdf';
import { expect, test } from 'vitest';

import { readPdf } from './pdf';

test('text and a first-page thumbnail are read from a PDF', async () => {
  const { text, thumbnail } = await readPdf(pdf(['foo', 'bar']));

  expect({ text, thumbnail: thumbnail?.type }).toEqual({
    text: 'foo\nbar',
    thumbnail: 'image/png',
  });
});
