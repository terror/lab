import { Card } from '@/components/ui/card';
import { LiveMark } from '@/components/ui/live-mark';
import { cn } from '@/lib/utils';
import { Slot } from 'radix-ui';
import * as React from 'react';

function NeedsYouCard({
  actions,
  children,
  className,
  glyph = <LiveMark className='size-4' state='waiting' />,
  label = 'Needs you',
  link,
  title,
  ...props
}: Omit<React.ComponentProps<'div'>, 'title'> & {
  actions?: React.ReactNode;
  glyph?: React.ReactNode;
  label?: string;
  link?: (title: React.ReactNode) => React.ReactElement;
  title: React.ReactNode;
}) {
  const name = <span className='truncate'>{title}</span>;

  return (
    <Card
      className={cn('gap-3 text-sm', className)}
      variant='outline'
      {...props}
    >
      <div className='flex min-w-0 items-center gap-3'>
        <span className='flex size-4 shrink-0 items-center justify-center'>
          {glyph}
        </span>
        <span className='flex min-w-0 flex-1 font-medium'>
          {link ? (
            <Slot.Root
              data-slot='needs-you-card-link'
              className='hit-area relative flex min-w-0 rounded-sm underline-offset-4 hover:underline'
            >
              {link(name)}
            </Slot.Root>
          ) : (
            name
          )}
        </span>
        <span className='shrink-0 text-xs font-medium text-status-attention-ink'>
          {label}
        </span>
      </div>
      {children ? (
        <div className='flex min-w-0 flex-col gap-3 pl-7 wrap-anywhere'>
          {children}
        </div>
      ) : null}
      {actions ? (
        <div className='flex flex-wrap items-center gap-2 pl-7'>{actions}</div>
      ) : null}
    </Card>
  );
}

export { NeedsYouCard };
