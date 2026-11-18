import { cn } from '@/lib/utils';
import * as React from 'react';

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      aria-hidden='true'
      data-slot='skeleton'
      className={cn(
        'relative h-3 overflow-hidden rounded-sm bg-muted after:absolute after:inset-0 after:-translate-x-full after:bg-linear-to-r after:from-transparent after:via-white/70 after:to-transparent motion-safe:after:animate-skeleton dark:after:via-white/5',
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
