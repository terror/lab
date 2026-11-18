import { markOutline } from '@/components/lab-mark';
import { cn } from '@/lib/utils';
import * as React from 'react';

function EmptyGlyph() {
  return (
    <svg
      aria-hidden='true'
      className='h-10.5 w-9 overflow-visible'
      fill='none'
      viewBox='-2 -10 36 42'
    >
      <path
        className='stroke-muted-foreground opacity-55'
        d={markOutline}
        strokeWidth='2'
      />
      <rect className='fill-spark-yellow' height='3' width='3' x='15' y='-7' />
    </svg>
  );
}

function EmptyState({
  action,
  className,
  description,
  glyph = <EmptyGlyph />,
  title,
  ...props
}: Omit<React.ComponentProps<'div'>, 'title'> & {
  action?: React.ReactNode;
  description: React.ReactNode;
  glyph?: React.ReactNode;
  title: React.ReactNode;
}) {
  return (
    <div
      data-slot='empty-state'
      className={cn(
        'flex flex-col items-center gap-2.5 px-5 py-7 text-center text-sm',
        className
      )}
      {...props}
    >
      <span className='text-muted-foreground'>{glyph}</span>
      <p className='mt-1 font-semibold'>{title}</p>
      <p className='max-w-xs text-balance text-muted-foreground'>
        {description}
      </p>
      {action && <div className='mt-1'>{action}</div>}
    </div>
  );
}

export { EmptyState };
