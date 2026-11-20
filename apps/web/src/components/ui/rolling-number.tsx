import { cn } from '@/lib/utils';
import NumberFlow, { type Format } from '@number-flow/react';

function RollingNumber({
  animated,
  className,
  format,
  value,
}: {
  animated?: boolean;
  className?: string;
  format?: Format;
  value: number;
}) {
  return (
    <NumberFlow
      animated={animated}
      className={cn('tabular-nums', className)}
      data-slot='rolling-number'
      format={format}
      locales='en-US'
      value={value}
    />
  );
}

export { RollingNumber };
