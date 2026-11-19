import { cn } from '@/lib/utils';
import * as React from 'react';

function HomeFrame({
  above,
  below,
  children,
  className,
  ...props
}: React.ComponentProps<'div'> & {
  above: React.ReactNode;
  below?: React.ReactNode;
}) {
  return (
    <div
      data-slot='home-frame'
      className={cn(
        '@container-size flex min-h-0 flex-1 flex-col overflow-y-auto',
        className
      )}
      {...props}
    >
      <div className='mx-auto flex w-full max-w-3xl flex-col px-6 pb-12'>
        <div
          data-slot='home-above'
          className='flex min-h-home-anchor flex-col items-center justify-end gap-4 pb-7 text-center'
        >
          {above}
        </div>
        <div data-slot='home-anchor'>{children}</div>
        {below}
      </div>
    </div>
  );
}

export { HomeFrame };
