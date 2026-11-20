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
    <>
      <span className='sr-only'>
        {new Intl.NumberFormat('en-US', format).format(value)}
      </span>
      <NumberFlow
        animated={animated && !quiet}
        aria-hidden='true'
        className={cn('tabular-nums', className)}
        data-slot='rolling-number'
        format={format}
        locales='en-US'
        opacityTiming={roll.fade}
        spinTiming={roll.turn}
        transformTiming={roll.turn}
        value={value}
      />
    </>
  );
}

export { RollingNumber };
