import { cn } from '@/lib/utils';
import * as React from 'react';

function SectionHeading({
  actions,
  children,
  className,
  ...props
}: React.ComponentProps<'div'> & { actions?: React.ReactNode }) {
  return (
    <div
      data-slot='section-heading'
      className={cn(
        'flex min-h-8 items-center justify-between gap-3',
        className
      )}
      {...props}
    >
      <h2 className='text-sm font-medium text-muted-foreground'>{children}</h2>
      {actions}
    </div>
  );
}

export { SectionHeading };
