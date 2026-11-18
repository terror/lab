import { cn } from '@/lib/utils';
import { Checkbox as CheckboxPrimitive } from 'radix-ui';
import * as React from 'react';

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot='checkbox'
      className={cn(
        'group/checkbox relative flex size-4 shrink-0 items-center justify-center rounded-[5px] border border-foreground/50 transition-colors after:absolute after:-inset-1.25 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive pointer-coarse:after:-inset-3.75 data-checked:border-primary data-checked:bg-primary',
        className
      )}
      {...props}
    >
      <svg
        aria-hidden='true'
        className='size-3 fill-none stroke-primary-foreground stroke-2'
        strokeLinecap='round'
        strokeLinejoin='round'
        viewBox='0 0 16 16'
      >
        <path
          className='transition-[stroke-dashoffset] duration-fast ease-in [stroke-dasharray:1] [stroke-dashoffset:1] group-data-checked/checkbox:delay-40 group-data-checked/checkbox:duration-base group-data-checked/checkbox:ease-out group-data-checked/checkbox:[stroke-dashoffset:0] motion-reduce:transition-none'
          d='M3.5 8.5l3 3 6-7'
          pathLength='1'
        />
      </svg>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
