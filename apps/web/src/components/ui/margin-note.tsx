import { fade, rise } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { AnimatePresence, m } from 'motion/react';
import * as React from 'react';

function MarginNote({
  children,
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='margin-note'
      role='status'
      className={cn('text-xs/4 text-muted-foreground', className)}
      {...props}
    >
      <AnimatePresence>
        {children && (
          <m.p
            key='note'
            className='flex min-w-0 items-start gap-2 text-pretty'
            {...rise(0)}
            exit={{ opacity: 0, transition: fade.leave }}
          >
            <span
              aria-hidden='true'
              className='mt-[5px] size-1.5 shrink-0 rounded-[2px] bg-current'
            />
            <span className='min-w-0'>{children}</span>
          </m.p>
        )}
      </AnimatePresence>
    </div>
  );
}

export { MarginNote };
