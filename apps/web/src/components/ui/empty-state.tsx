import { markOutline } from '@/components/lab-mark';
import { cn } from '@/lib/utils';
import * as React from 'react';

type Pose =
  | 'asleep'
  | 'default'
  | 'drained'
  | 'puzzled'
  | 'stretching'
  | 'tipped';

const entered = new Set<Pose>();

function EmptyGlyph({ pose }: { pose?: Pose }) {
  const [enter] = React.useState(
    () => pose !== undefined && pose !== 'tipped' && !entered.has(pose)
  );

  React.useEffect(() => {
    if (pose) {
      entered.add(pose);
    }
  }, [pose]);

  return (
    <svg
      aria-hidden='true'
      className='h-10.5 w-9 overflow-visible'
      data-enter={enter || undefined}
      data-pose={pose}
      data-slot='empty-glyph'
      fill='none'
      viewBox='-2 -10 36 42'
    >
      <g data-part='flask'>
        <path
          className='stroke-muted-foreground opacity-55'
          d={markOutline}
          strokeWidth='2'
        />
        <rect
          className={
            pose === 'tipped' ? 'fill-spark-coral' : 'fill-spark-yellow'
          }
          data-part='drop'
          height='3'
          width='3'
          x='15'
          y='-7'
        />
      </g>
      {pose === 'asleep' && (
        <>
          <rect
            className='fill-current'
            data-part='z1'
            height='2'
            width='2'
            x='24'
            y='0'
          />
          <rect
            className='fill-current'
            data-part='z2'
            height='3'
            width='3'
            x='27'
            y='-5'
          />
        </>
      )}
    </svg>
  );
}

function EmptyState({
  action,
  className,
  description,
  pose,
  glyph = <EmptyGlyph pose={pose} />,
  title,
  ...props
}: Omit<React.ComponentProps<'div'>, 'title'> & {
  action?: React.ReactNode;
  description: React.ReactNode;
  glyph?: React.ReactNode;
  pose?: Pose;
  title: React.ReactNode;
}) {
  return (
    <div
      data-slot='empty-state'
      className={cn(
        'flex flex-col items-center gap-2.5 px-5 py-7 text-center text-sm',
        className
      )}
      {...props}
    >
      <span className='text-muted-foreground'>{glyph}</span>
      <p className='mt-1 font-semibold'>{title}</p>
      <p className='max-w-xs text-balance text-muted-foreground'>
        {description}
      </p>
      {action && <div className='mt-1'>{action}</div>}
    </div>
  );
}

export { EmptyState, type Pose };
