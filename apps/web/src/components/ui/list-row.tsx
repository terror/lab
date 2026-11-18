import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Slot } from 'radix-ui';
import * as React from 'react';

const sizes = {
  compact: {
    content: 'min-h-8 gap-2 pr-2 pl-2 pointer-coarse:min-h-11',
    row: '',
    trailing: 'mr-1',
  },
  default: {
    content: 'min-h-11 gap-3 pr-1.5 pl-3',
    row: '-mx-3',
    trailing: 'mr-1.5',
  },
};

function ListRow({
  actions,
  asChild = false,
  children,
  className,
  size = 'default',
  status,
  ...props
}: React.ComponentProps<'li'> & {
  actions?: React.ReactNode;
  asChild?: boolean;
  size?: keyof typeof sizes;
  status?: React.ReactNode;
}) {
  const Content = asChild ? Slot.Root : 'div';

  return (
    <li
      data-size={size}
      data-slot='list-row'
      className={cn(
        'group/list-row flex items-center rounded-menu text-sm transition-colors hover:bg-muted has-[[data-state=open]]:bg-muted',
        sizes[size].row,
        className
      )}
      {...props}
    >
      <Content
        data-slot='list-row-content'
        className={cn(
          'flex min-w-0 flex-1 items-center rounded-menu py-1.5 text-left focus-ring-inset',
          sizes[size].content
        )}
      >
        {children}
      </Content>
      {(actions || status) && (
        <div
          className={cn(
            'relative flex shrink-0 items-center gap-1.5',
            sizes[size].trailing
          )}
        >
          {status && (
            <span
              data-slot='list-row-status'
              className={cn(
                'pointer-events-none flex items-center justify-center transition-opacity',
                actions &&
                  'pointer-fine:absolute pointer-fine:inset-0 pointer-fine:group-hover/list-row:opacity-0 pointer-fine:group-has-focus-visible/list-row:opacity-0 pointer-fine:group-has-data-[state=open]/list-row:opacity-0'
              )}
            >
              {status}
            </span>
          )}
          {actions && (
            <div
              data-slot='list-row-actions'
              className='flex items-center gap-0.5 hover-reveal group-hover/list-row:opacity-100 group-has-focus-visible/list-row:opacity-100 pointer-coarse:gap-4'
            >
              {actions}
            </div>
          )}
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
