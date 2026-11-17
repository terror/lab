import type { PDFDocumentProxy } from 'pdfjs-dist';

const THUMBNAIL_WIDTH = 480;

async function pdfjs() {
  const [library, worker] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]);

  library.GlobalWorkerOptions.workerSrc = worker.default;

  return library;
}

export async function openPdf(data: Uint8Array) {
  const { getDocument } = await pdfjs();

  return getDocument({ data });
}

async function documentText(document: PDFDocumentProxy) {
  const pages = await Promise.all(
    Array.from({ length: document.numPages }, async (_, index) => {
      const page = await document.getPage(index + 1);

      const { items } = await page.getTextContent();

      return items
        .map((item) => {
          if (!('str' in item)) {
            return '';
          }

          return item.hasEOL ? `${item.str}\n` : item.str;
        })
        .join('');
    })
  );

  return pages.join('\n\n').trim();
}

export async function renderPage(
  document: PDFDocumentProxy,
  number: number,
  canvas: HTMLCanvasElement,
  width: number
) {
  const page = await document.getPage(number);

  const viewport = page.getViewport({
    scale: width / page.getViewport({ scale: 1 }).width,
  });

  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  await page.render({ canvas, viewport }).promise;
}

async function thumbnail(document: PDFDocumentProxy) {
  const canvas = window.document.createElement('canvas');

  await renderPage(document, 1, canvas, THUMBNAIL_WIDTH);

  return new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png')
  );
}

export async function readPdf(file: Blob) {
  const task = await openPdf(new Uint8Array(await file.arrayBuffer()));

  try {
    const document = await task.promise;

    const [text, image] = await Promise.all([
      documentText(document),
      thumbnail(document).catch(() => null),
    ]);

    return { text, thumbnail: image ?? undefined };
  } finally {
    await task.destroy();
  }
}
