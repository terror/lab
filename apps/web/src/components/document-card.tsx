import { PdfPages } from '@/components/pdf-pages';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { uploadThumbnailUrl, uploadUrl } from '@/lib/uploads';
import { Download, FileText } from 'lucide-react';
import { useState } from 'react';

export function DocumentThumbnail({
  className,
  uploadId,
}: {
  className?: string;
  uploadId: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span className={className}>
        <FileText aria-hidden='true' className='size-5 text-muted-foreground' />
      </span>
    );
  }

  return (
    <img
      alt=''
      className={className}
      decoding='async'
      loading='lazy'
      onError={() => setFailed(true)}
      src={uploadThumbnailUrl(uploadId)}
    />
  );
}

export function DocumentCard({
  name,
  uploadId,
}: {
  name: string;
  uploadId: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        aria-label={`Open ${name}`}
        className='group relative h-44 w-36 overflow-hidden rounded-xl bg-muted text-left outline-none'
        onClick={() => setOpen(true)}
        type='button'
      >
        <DocumentThumbnail
          className='flex size-full items-center justify-center bg-white object-cover object-top transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none'
          uploadId={uploadId}
        />
        <span className='absolute top-2 left-2 rounded-md bg-background px-1.5 py-0.5 text-xs font-medium text-muted-foreground'>
          PDF
        </span>
        <span className='absolute inset-x-0 bottom-0 truncate bg-linear-to-t from-black/70 px-3 pt-8 pb-2.5 text-sm font-medium text-white'>
          {name}
        </span>
      </button>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent className='sm:max-w-3xl'>
          <DialogHeader>
            <DialogTitle className='truncate pr-8'>{name}</DialogTitle>
          </DialogHeader>
          {open && (
            <PdfPages
              className='max-h-128 overflow-y-auto rounded-xl bg-muted p-3'
              url={uploadUrl(uploadId)}
            />
          )}
          <DialogFooter>
            <Button asChild>
              <a download={name} href={uploadUrl(uploadId)}>
                <Download aria-hidden='true' />
                Download
              </a>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
