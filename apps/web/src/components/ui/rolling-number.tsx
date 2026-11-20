import { useMoment } from '@/lib/moment';
import { roll } from '@/lib/motion';
import { cn } from '@/lib/utils';
import NumberFlow, { type Format } from '@number-flow/react';

function RollingNumber({
  animated = true,
  className,
  format,
  steady = false,
  value,
}: {
  animated?: boolean;
  className?: string;
  format?: Format;
  steady?: boolean;
  value: number;
}) {
  const rolls = useMoment('places.roll').on;

  return (
    <>
      <span className='sr-only'>
        {new Intl.NumberFormat('en-US', format).format(value)}
      </span>
      <NumberFlow
        animated={animated && rolls}
        aria-hidden='true'
        className={cn('-my-[0.25em] tabular-nums', className)}
        data-slot='rolling-number'
        format={format}
        isolate={steady}
        locales='en-US'
        opacityTiming={roll.fade}
        spinTiming={roll.turn}
        transformTiming={steady ? { duration: 0 } : roll.turn}
        value={value}
      />
    </>
  );
}

export { RollingNumber };
