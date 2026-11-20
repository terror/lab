import { Dot } from '@/components/ui/dot';
import { RollingNumber } from '@/components/ui/rolling-number';
import { cn } from '@/lib/utils';
import * as React from 'react';

const Still = React.createContext(false);

function Brief({
  className,
  still = false,
  ...props
}: React.ComponentProps<'p'> & { still?: boolean }) {
  return (
    <Still value={still}>
      <p
        aria-atomic='true'
        aria-live='polite'
        data-slot='brief'
        className={cn(
          'isolate max-w-xl text-base/relaxed text-balance text-muted-foreground',
          className
        )}
        {...props}
      />
    </Still>
  );
}

function BriefToken({
  attention = false,
  children,
  className,
  count,
  ...props
}: Omit<React.ComponentProps<'button'>, 'type'> & {
  attention?: boolean;
  count: number;
}) {
  const still = React.use(Still);

  return (
    <button
      data-slot='brief-token'
      className={cn(
        'hit-area relative -mx-1 inline-flex items-baseline gap-1 rounded-sm px-1 font-medium text-foreground before:absolute before:inset-0 before:-z-1 before:rounded-sm before:transition-colors hover:before:bg-muted pointer-coarse:after:-z-1',
        className
      )}
      type='button'
      {...props}
    >
      {attention && count > 0 && (
        <Dot className='self-center' tone='attention' />
      )}
      <RollingNumber animated={!still} steady value={count} />
      {children}
    </button>
  );
}

export { Brief, BriefToken };
