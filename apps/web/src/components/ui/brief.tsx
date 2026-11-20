import { Dot } from '@/components/ui/dot';
import { RollingNumber } from '@/components/ui/rolling-number';
import { cn } from '@/lib/utils';
import * as React from 'react';

function Brief({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      aria-live='polite'
      data-slot='brief'
      className={cn(
        'max-w-xl text-base/relaxed text-balance text-muted-foreground',
        className
      )}
      {...props}
    />
  );
}

function BriefToken({
  children,
  className,
  count,
  still = false,
  tone,
  ...props
}: Omit<React.ComponentProps<'button'>, 'type'> & {
  count: number;
  still?: boolean;
  tone?: 'attention' | 'live';
}) {
  return (
    <button
      data-slot='brief-token'
      className={cn(
        'hit-area relative -mx-1 inline-flex items-baseline gap-1.5 rounded-sm px-1 font-medium text-foreground transition-colors hover:bg-muted',
        className
      )}
      type='button'
      {...props}
    >
      {tone && <Dot className='self-center' tone={tone} />}
      <RollingNumber animated={!still} value={count} />
      {children}
    </button>
  );
}

export { Brief, BriefToken };
