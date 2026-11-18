import { cn } from '@/lib/utils';
import * as React from 'react';

function Page({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='page'
      className={cn(
        'mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-8',
        className
      )}
      {...props}
    />
  );
}

function PageHeader({
  actions,
  className,
  description,
  title,
  ...props
}: Omit<React.ComponentProps<'div'>, 'title'> & {
  actions?: React.ReactNode;
  description?: React.ReactNode;
  title: React.ReactNode;
}) {
  return (
    <div
      data-slot='page-header'
      className={cn(
        'flex items-end justify-between gap-4 border-b pb-4',
        className
      )}
      {...props}
    >
      <div className='flex min-w-0 flex-col gap-1'>
        <h1 className='text-2xl font-semibold tracking-tight'>{title}</h1>
        {description && (
          <p className='text-sm text-muted-foreground'>{description}</p>
        )}
      </div>
      {actions && <div className='flex shrink-0 gap-2'>{actions}</div>}
    </div>
  );
}

export { Page, PageHeader };
