import { expect, test } from 'vitest';

import { readPdf } from './pdf';

function pdf(lines: string[]) {
  const stream = lines
    .map(
      (line, index) => `BT /F1 12 Tf 20 ${180 - index * 20} Td (${line}) Tj ET`
    )
    .join('\n');

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];

  const header = '%PDF-1.4\n';

  const bodies = objects.map(
    (object, index) => `${index + 1} 0 obj\n${object}\nendobj\n`
  );

  const offsets = bodies.map(
    (_, index) =>
      header.length +
      bodies.slice(0, index).reduce((total, body) => total + body.length, 0)
  );

  const start = header.length + bodies.join('').length;

  const xref = [
    `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`,
    ...offsets.map(
      (offset) => `${String(offset).padStart(10, '0')} 00000 n \n`
    ),
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`,
  ].join('');

  return new Blob([header, ...bodies, xref], { type: 'application/pdf' });
}

test('text and a first-page thumbnail are read from a PDF', async () => {
  const { text, thumbnail } = await readPdf(pdf(['foo', 'bar']));

  expect({ text, thumbnail: thumbnail?.type }).toEqual({
    text: 'foo\nbar',
    thumbnail: 'image/png',
  });
});
