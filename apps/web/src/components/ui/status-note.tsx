import { fade } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { AnimatePresence, m } from 'motion/react';
import * as React from 'react';

function StatusNote({
  children,
  className,
  ...props
}: Omit<React.ComponentProps<'span'>, 'children'> & { children?: string }) {
  return (
    <span
      data-slot='status-note'
      role='status'
      className={cn('flex shrink-0 text-xs text-muted-foreground', className)}
      {...props}
    >
      <AnimatePresence initial={false} mode='wait'>
        {children && (
          <m.span
            key={children}
            animate={{ opacity: 1, transition: fade.fast }}
            className='truncate'
            exit={{ opacity: 0, transition: fade.leave }}
            initial={{ opacity: 0 }}
          >
            {children}
          </m.span>
        )}
      </AnimatePresence>
    </span>
  );
}

export { StatusNote };
