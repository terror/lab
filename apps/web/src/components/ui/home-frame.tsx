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
        '@container-size flex size-full min-h-0 flex-1 scrollbar-gutter-both flex-col overflow-y-auto',
        className
      )}
      {...props}
    >
      <div className='mx-auto flex w-full max-w-3xl flex-col px-6 pb-12 phone:min-h-full phone:pb-0'>
        <div
          data-slot='home-above'
          className='flex min-h-home-anchor shrink-0 flex-col items-center justify-end gap-4 pb-7 text-center phone:min-h-0 phone:pt-10'
        >
          {above}
        </div>
        <div
          data-slot='home-anchor'
          className='phone:sticky phone:bottom-0 phone:z-10 phone:order-last phone:mt-auto phone:bg-background phone:pt-2 phone:pb-6'
        >
          {children}
        </div>
        {below}
      </div>
    </div>
  );
}

export { HomeFrame };
