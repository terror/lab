import { cn } from '@/lib/utils';
import * as React from 'react';

function TaskClock({
  className,
  paused,
  progress,
  turns = 0,
  ...props
}: Omit<React.ComponentProps<'svg'>, 'children'> & {
  paused?: boolean;
  progress?: number;
  turns?: number;
}) {
  const [settled, setSettled] = React.useState(turns);

  const fraction = Math.min(Math.max(progress ?? 0, 0), 1);

  const [cycle, setCycle] = React.useState({ fraction, laps: 0 });

  if (cycle.fraction !== fraction) {
    setCycle({
      fraction,
      laps: fraction < cycle.fraction ? cycle.laps + 1 : cycle.laps,
    });
  }

  return (
    <svg
      aria-hidden='true'
      data-paused={paused || undefined}
      data-slot='task-clock'
      className={cn(
        'size-4 shrink-0 text-muted-foreground transition-opacity duration-base data-paused:opacity-45',
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
        className='transition-transform duration-slow ease-out data-winding:duration-story motion-reduce:transition-none'
        data-winding={turns !== settled || undefined}
        onTransitionEnd={() => setSettled(turns)}
        style={{
          transform: `rotate(${(fraction + turns + cycle.laps) * 360}deg)`,
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
