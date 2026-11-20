import { roll } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { useQuiet } from '@/lib/voice';
import NumberFlow, { type Format } from '@number-flow/react';

function RollingNumber({
  animated = true,
  className,
  format,
  value,
}: {
  animated?: boolean;
  className?: string;
  format?: Format;
  value: number;
}) {
  const quiet = useQuiet();

  return (
    <NumberFlow
      animated={animated && !quiet}
      className={cn('tabular-nums', className)}
      data-slot='rolling-number'
      format={format}
      locales='en-US'
      spinTiming={roll}
      transformTiming={roll}
      value={value}
    />
  );
}

export { RollingNumber };
