import { markShapes } from '@/components/lab-mark';
import { cn } from '@/lib/utils';
import * as React from 'react';

const sparkles = [
  { dx: -5, dy: -5, part: 'sparkle', size: 3, x: 5, y: 4 },
  { dx: 5, dy: -5, part: 'sparkle', size: 3, x: 24, y: 4 },
  { dx: -6, dy: 0, part: 'sparkle', size: 2, x: 2, y: 13 },
  { dx: 6, dy: 0, part: 'sparkle', size: 2, x: 28, y: 13 },
  { dx: -3, dy: -6, part: 'sparkle-proud', size: 2, x: 10, y: -3 },
  { dx: 3, dy: -6, part: 'sparkle-proud', size: 2, x: 20, y: -3 },
];

function LiveMark({
  className,
  state = 'idle',
  ...props
}: Omit<React.ComponentProps<'svg'>, 'children'> & {
  state?: 'assemble' | 'done' | 'error' | 'idle' | 'proud' | 'thinking';
}) {
  return (
    <svg
      aria-hidden='true'
      data-slot='live-mark'
      data-state={state}
      className={cn('size-8 shrink-0 overflow-visible', className)}
      fill='none'
      viewBox='0 0 32 32'
      {...props}
    >
      <g data-part='all'>
        <path
          className='fill-spark-coral'
          d={markShapes.coral}
          data-part='coral'
        />
        <path
          className='fill-spark-blue'
          d={markShapes.blue}
          data-part='blue'
        />
        <path
          className='fill-spark-yellow'
          d={markShapes.yellow}
          data-part='yellow'
        />
        <rect
          className='fill-spark-blue'
          data-part='bubble'
          height='4'
          width='4'
          x='14'
          y='10'
        />
        <rect
          className='fill-spark-yellow'
          data-part='bubble'
          height='4'
          width='4'
          x='14'
          y='10'
        />
        {sparkles.map(({ dx, dy, part, size, x, y }) => (
          <rect
            key={`${x}-${y}`}
            className='fill-spark-yellow'
            data-part={part}
            height={size}
            style={
              { '--dx': `${dx}px`, '--dy': `${dy}px` } as React.CSSProperties
            }
            width={size}
            x={x}
            y={y}
          />
        ))}
      </g>
    </svg>
  );
}

export { LiveMark };
