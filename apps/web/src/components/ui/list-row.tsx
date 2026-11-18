import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Slot } from 'radix-ui';
import * as React from 'react';

function ListRow({
  actions,
  asChild = false,
  children,
  className,
  ...props
}: React.ComponentProps<'li'> & {
  actions?: React.ReactNode;
  asChild?: boolean;
}) {
  const Content = asChild ? Slot.Root : 'div';

  return (
    <li
      data-slot='list-row'
      className={cn(
        'group/list-row -mx-3 flex items-center rounded-menu text-sm transition-colors hover:bg-muted has-[[data-state=open]]:bg-muted',
        className
      )}
      {...props}
    >
      <Content
        data-slot='list-row-content'
        className='flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-menu py-1.5 pr-1.5 pl-3 text-left focus-ring-inset'
      >
        {children}
      </Content>
      {actions && (
        <div
          data-slot='list-row-actions'
          className='flex shrink-0 items-center gap-0.5 pr-1.5 hover-reveal group-focus-within/list-row:opacity-100 group-hover/list-row:opacity-100 pointer-coarse:gap-4'
        >
          {actions}
        </div>
      )}
    </li>
  );
}

function ListSkeleton({ className, ...props }: React.ComponentProps<'ul'>) {
  return (
    <ul
      aria-busy='true'
      data-slot='list-skeleton'
      className={cn('flex flex-col gap-0.5', className)}
      {...props}
    >
      {[0, 1, 2].map((row) => (
        <li key={row} className='flex min-h-11 items-center gap-3 py-1.5'>
          <Skeleton className='size-4 rounded-full' />
          <div className='flex flex-1 flex-col gap-2'>
            <Skeleton className='w-2/5' />
            <Skeleton className='w-3/5' />
          </div>
        </li>
      ))}
    </ul>
  );
}

export { ListRow, ListSkeleton };
