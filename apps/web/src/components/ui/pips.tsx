import { cn } from '@/lib/utils';
import * as React from 'react';

const LIMIT = 8;

function pipState(index: number, done: number) {
  if (index < done) {
    return 'done';
  }

  return index === done ? 'current' : 'ahead';
}

function Pips({
  className,
  done,
  total,
  ...props
}: Omit<React.ComponentProps<'span'>, 'children'> & {
  done: number;
  total: number;
}) {
  if (total < 1 || total > LIMIT) {
    return null;
  }

  return (
    <span
      aria-hidden='true'
      data-slot='pips'
      className={cn('inline-flex shrink-0 items-center gap-[3px]', className)}
      {...props}
    >
      {Array.from({ length: total }, (_, index) => (
        <span
          key={index}
          data-state={pipState(index, done)}
          className='size-1.5 rounded-[1.5px] bg-foreground/15 transition-colors duration-slow data-[state=current]:bg-status-live/45 data-[state=done]:bg-status-live'
        />
      ))}
    </span>
  );
}

export { Pips };
