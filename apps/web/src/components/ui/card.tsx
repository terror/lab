import { cn } from '@/lib/utils';
import { type VariantProps, cva } from 'class-variance-authority';
import * as React from 'react';

const cardVariants = cva('flex flex-col gap-2.5 rounded-card p-4', {
  variants: {
    variant: {
      inset: 'bg-foreground/4',
      outline: 'border',
    },
  },
});

function Card({
  className,
  variant,
  ...props
}: React.ComponentProps<'div'> & {
  variant: NonNullable<VariantProps<typeof cardVariants>['variant']>;
}) {
  return (
    <div
      data-slot='card'
      data-variant={variant}
      className={cn(cardVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Card };
