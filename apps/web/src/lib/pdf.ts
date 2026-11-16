export async function pdfText(file: Blob) {
  const [{ GlobalWorkerOptions, getDocument }, worker] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]);

  GlobalWorkerOptions.workerSrc = worker.default;

  const task = getDocument({ data: new Uint8Array(await file.arrayBuffer()) });

  try {
    const document = await task.promise;

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
  } finally {
    await task.destroy();
  }
}
