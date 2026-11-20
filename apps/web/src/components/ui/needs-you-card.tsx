import { Card } from '@/components/ui/card';
import { Dot } from '@/components/ui/dot';
import { cn } from '@/lib/utils';
import { Slot } from 'radix-ui';
import * as React from 'react';

function NeedsYouCard({
  actions,
  children,
  className,
  glyph = <Dot tone='attention' />,
  label = 'Needs you',
  renderLink,
  title,
  ...props
}: Omit<React.ComponentProps<'div'>, 'title'> & {
  actions?: React.ReactNode;
  glyph?: React.ReactNode;
  label?: string;
  renderLink?: (title: React.ReactNode) => React.ReactElement;
  title: React.ReactNode;
}) {
  const id = React.useId();

  const name = (
    <span className='truncate' id={id}>
      {title}
    </span>
  );

  return (
    <Card
      aria-labelledby={id}
      className={cn('gap-3 text-sm', className)}
      role='group'
      variant='outline'
      {...props}
    >
      <div className='flex min-w-0 items-center gap-3'>
        <span className='flex size-4 shrink-0 items-center justify-center'>
          {glyph}
        </span>
        <span className='flex min-w-0 flex-1 font-medium'>
          {renderLink ? (
            <Slot.Root
              data-slot='needs-you-card-link'
              className='hit-area relative flex min-w-0 rounded-sm underline-offset-4 hover:underline'
            >
              {renderLink(name)}
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
        <div className='flex flex-wrap items-center gap-2 pl-7 pointer-coarse:mt-2'>
          {actions}
        </div>
      ) : null}
    </Card>
  );
}

export { NeedsYouCard };
