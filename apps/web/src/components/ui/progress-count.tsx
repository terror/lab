import { RollingNumber } from '@/components/ui/rolling-number';
import { cn } from '@/lib/utils';
import * as React from 'react';

function ProgressCount({
  className,
  done,
  total,
  ...props
}: Omit<React.ComponentProps<'span'>, 'children'> & {
  done: number;
  total: number;
}) {
  const complete = total > 0 && done === total;

  return (
    <span
      data-slot='progress-count'
      data-complete={complete || undefined}
      className={cn(
        'text-xs text-muted-foreground tabular-nums transition-colors duration-slow data-complete:text-status-done-ink',
        className
      )}
      {...props}
    >
      <RollingNumber value={done} /> of {total} done
    </span>
  );
}

export { ProgressCount };
