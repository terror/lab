import { Card } from '@/components/ui/card';
import { Dot } from '@/components/ui/dot';
import { cn } from '@/lib/utils';
import * as React from 'react';

function NeedsYouCard({
  actions,
  children,
  className,
  glyph = <Dot tone='attention' />,
  label = 'Needs you',
  title,
  ...props
}: Omit<React.ComponentProps<'div'>, 'title'> & {
  actions?: React.ReactNode;
  glyph?: React.ReactNode;
  label?: string;
  title: React.ReactNode;
}) {
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
        <span className='min-w-0 flex-1 truncate font-medium'>{title}</span>
        <span className='shrink-0 text-xs font-medium text-status-attention-ink'>
          {label}
        </span>
      </div>
      {children && <div className='flex flex-col gap-3 pl-7'>{children}</div>}
      {actions && (
        <div className='flex flex-wrap items-center gap-2 pl-7'>{actions}</div>
      )}
    </Card>
  );
}

export { NeedsYouCard };
