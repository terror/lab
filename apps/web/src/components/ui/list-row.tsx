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

export { ListRow };
