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
import { cn } from '@/lib/utils';
import { useQuiet } from '@/lib/voice';
import { Download } from 'lucide-react';
import { useState } from 'react';

export function ImageCard({
  className,
  name,
  src,
}: {
  className?: string;
  name: string;
  src: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const quiet = useQuiet();

  return (
    <Dialog>
      <DialogTrigger
        aria-label={`Open ${name}`}
        className='block max-w-full self-start overflow-hidden rounded-card ring-1 ring-foreground/10'
      >
        <img
          alt={name}
          className={cn(
            'block max-w-full object-contain opacity-0 transition-opacity duration-base data-loaded:opacity-100',
            !quiet && 'motion-safe:data-loaded:animate-develop',
            className
          )}
          data-loaded={loaded || undefined}
          onLoad={() => setLoaded(true)}
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
