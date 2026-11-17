import { renderPage, openPdf } from '@/lib/pdf';
import { cn } from '@/lib/utils';
import { useEffect, useRef, useState } from 'react';

const MAX_PAGES = 50;

type Status = 'error' | 'loading' | 'ready';

export function PdfPages({
  className,
  url,
}: {
  className?: string;
  url: string;
}) {
  const pages = useRef<HTMLDivElement>(null);

  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    const element = pages.current;

    if (!element) {
      return undefined;
    }

    const controller = new AbortController();

    const { signal } = controller;

    setStatus('loading');

    const loading = (async () => {
      const response = await fetch(url, { signal });

      if (!response.ok) {
        throw new Error('Unable to load PDF');
      }

      const task = await openPdf(new Uint8Array(await response.arrayBuffer()));

      signal.addEventListener('abort', () => void task.destroy());

      const document = await task.promise;

      const width = element.clientWidth * window.devicePixelRatio;

      for (
        let number = 1;
        number <= Math.min(document.numPages, MAX_PAGES) && !signal.aborted;
        number += 1
      ) {
        const canvas = window.document.createElement('canvas');

        canvas.className = 'w-full rounded-md bg-white shadow-sm';

        await renderPage(document, number, canvas, width);

        if (!signal.aborted) {
          element.append(canvas);
          setStatus('ready');
        }
      }
    })();

    loading.catch(() => {
      if (!signal.aborted) {
        setStatus('error');
      }
    });

    return () => {
      controller.abort();
      element.replaceChildren();
    };
  }, [url]);

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {status === 'loading' && (
        <p className='text-sm text-muted-foreground'>Loading PDF…</p>
      )}
      {status === 'error' && (
        <p role='alert' className='text-sm text-destructive'>
          Unable to load this PDF.
        </p>
      )}
      <div ref={pages} className='flex flex-col gap-3' />
    </div>
  );
}
