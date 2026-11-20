import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useMoment } from '@/lib/moment';
import { cn } from '@/lib/utils';
import { Download } from 'lucide-react';
import { useState } from 'react';

const box =
  'relative block max-w-full self-start overflow-hidden rounded-card ring-1 ring-foreground/10';

type Source = { frame: string; src?: string } | { frame?: string; src: string };

export function ImageCard({
  className,
  frame,
  name,
  src,
}: Source & { className?: string; name: string }) {
  const [status, setStatus] = useState<'failed' | 'loaded' | 'loading'>(
    'loading'
  );
  const loaded = status === 'loaded';
  const develop = useMoment('image.develop', { when: loaded }).on;

  const reserved = frame !== undefined && status === 'loading';

  const frameClass = cn(box, reserved && frame);

  const skeleton = reserved && (
    <Skeleton className='absolute inset-0 h-auto rounded-none' />
  );

  if (src === undefined) {
    return <div className={frameClass}>{skeleton}</div>;
  }

  return (
    <Dialog>
      <DialogTrigger aria-label={`Open ${name}`} className={frameClass}>
        {skeleton}
        <img
          alt={name}
          className={cn(
            'block max-w-full object-contain opacity-0 transition-opacity duration-base data-loaded:opacity-100',
            develop && 'motion-safe:animate-develop',
            className
          )}
          data-loaded={loaded || undefined}
          onError={() => setStatus('failed')}
          onLoad={() => setStatus('loaded')}
          src={src}
        />
      </DialogTrigger>
      <DialogContent className='sm:max-w-4xl'>
        <DialogHeader>
          <DialogTitle className='truncate pr-8'>{name}</DialogTitle>
          <DialogDescription className='sr-only'>
            Full size view of the image
          </DialogDescription>
        </DialogHeader>
        <img
          alt={name}
          className='mx-auto max-w-full rounded-card object-contain'
          src={src}
          style={{ maxHeight: '75dvh' }}
        />
        <DialogFooter>
          <Button asChild>
            <a download={name} href={src}>
              <Download aria-hidden='true' />
              Download
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
