import { useMoment } from '@/lib/moment';
import { story } from '@/lib/motion';
import { cn } from '@/lib/utils';
import * as React from 'react';

function TaskClock({
  className,
  paused,
  progress,
  since,
  turns = 0,
  ...props
}: Omit<React.ComponentProps<'svg'>, 'children'> & {
  paused?: boolean;
  progress?: number;
  since?: string;
  turns?: number;
}) {
  const quiet = !useMoment('places.wind').on;

  const fraction =
    paused || progress === undefined || !Number.isFinite(progress)
      ? undefined
      : Math.min(Math.max(progress, 0), 1);

  const [cycle, setCycle] = React.useState({
    fraction: fraction ?? 0,
    laps: 0,
    since,
  });

  if (
    fraction !== undefined &&
    (fraction !== cycle.fraction || since !== cycle.since)
  ) {
    setCycle({
      fraction,
      laps:
        cycle.since !== undefined && since !== cycle.since
          ? cycle.laps + 1
          : cycle.laps,
      since,
    });
  }

  const wound = quiet ? 0 : turns;

  const [settled, setSettled] = React.useState(wound);

  React.useEffect(() => {
    if (settled === wound) {
      return undefined;
    }

    const timer = setTimeout(() => setSettled(wound), story * 1000);

    return () => clearTimeout(timer);
  }, [settled, wound]);

  return (
    <svg
      aria-hidden='true'
      data-paused={paused || undefined}
      data-slot='task-clock'
      className={cn(
        'size-4 shrink-0 text-muted-foreground transition-opacity duration-base data-paused:opacity-45 motion-reduce:transition-none',
        className
      )}
      fill='none'
      stroke='currentColor'
      strokeLinecap='round'
      strokeWidth={2}
      viewBox='0 0 24 24'
      {...props}
    >
      <circle cx='12' cy='12' r='10' />
      <line
        data-quiet={quiet || undefined}
        data-winding={wound !== settled || undefined}
        className='transition-transform duration-slow ease-out data-quiet:transition-none data-winding:duration-story motion-reduce:transition-none'
        style={{
          transform: `rotate(${(cycle.fraction + cycle.laps + wound) * 360}deg)`,
          transformOrigin: '12px 12px',
        }}
        x1='12'
        x2='12'
        y1='12'
        y2='6'
      />
    </svg>
  );
}

export { TaskClock };
