import { markOutline } from '@/components/lab-mark';
import { cn } from '@/lib/utils';
import * as React from 'react';

const interior =
  'M11 3H21V5H19V15H23V19H25V23H29V25H25V29H7V25H3V23H7V19H9V15H13V5H11Z';

const bands = [
  { bottom: 29, top: 25, width: 18 },
  { bottom: 25, top: 23, width: 26 },
  { bottom: 23, top: 19, width: 18 },
  { bottom: 19, top: 15, width: 14 },
  { bottom: 15, top: 5, width: 6 },
];

const capacity = bands.reduce(
  (sum, { bottom, top, width }) => sum + (bottom - top) * width,
  0
);

function surface(value: number) {
  let left = Math.min(Math.max(value, 0), 1) * capacity;

  for (const { bottom, top, width } of bands) {
    const area = (bottom - top) * width;

    if (left <= area) {
      return bottom - left / width;
    }

    left -= area;
  }

  return 5;
}

type Tone = 'near' | 'over';

function Bar({ tone, value }: { tone?: Tone; value: number }) {
  return (
    <div className='h-1.5 overflow-hidden rounded-full bg-foreground/10'>
      <div
        className={cn(
          'h-full rounded-full bg-foreground transition-all',
          tone === 'over' && 'bg-destructive'
        )}
        style={{ width: `${Math.min(1, value) * 100}%` }}
      />
    </div>
  );
}

function Flask({
  pour,
  tone,
  value,
}: {
  pour: boolean;
  tone?: Tone;
  value: number;
}) {
  const id = React.useId();
  const [poured, setPoured] = React.useState(!pour);

  React.useEffect(() => {
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setPoured(true));
    });

    return () => cancelAnimationFrame(frame);
  }, []);

  const level = poured ? surface(value) : 29;

  return (
    <svg
      className='h-18 w-16 shrink-0 overflow-visible'
      fill='none'
      shapeRendering='crispEdges'
      viewBox='0 -4 32 36'
    >
      <defs>
        <clipPath id={id}>
          <path d={interior} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id})`}>
        <g
          className='transition-transform duration-story ease-out motion-reduce:transition-none'
          style={{ transform: `translateY(${level}px)` }}
        >
          <rect
            className={
              tone === 'over' ? 'fill-destructive' : 'fill-foreground/25'
            }
            height='32'
            width='32'
          />
          <rect
            className={cn(
              tone === 'near' && 'fill-spark-coral',
              tone === 'over' && 'fill-destructive',
              !tone && 'fill-foreground/40'
            )}
            height='2'
            width='32'
          />
        </g>
      </g>
      <path
        className='stroke-muted-foreground'
        d={markOutline}
        strokeWidth='2'
      />
      {tone === 'over' && (
        <rect
          className='fill-destructive'
          data-part='drop'
          height='3'
          width='3'
          x='22'
          y='-2'
        />
      )}
    </svg>
  );
}

function Meter({
  className,
  label,
  pour = false,
  tone,
  value,
  variant = 'bar',
}: {
  className?: string;
  label: string;
  pour?: boolean;
  tone?: Tone;
  value: number;
  variant?: 'bar' | 'flask';
}) {
  return (
    <div
      aria-label={label}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={Math.round(Math.min(1, Math.max(0, value)) * 100)}
      className={className}
      data-slot='meter'
      data-tone={tone}
      data-variant={variant}
      role='meter'
    >
      {variant === 'flask' ? (
        <Flask pour={pour} tone={tone} value={value} />
      ) : (
        <Bar tone={tone} value={value} />
      )}
    </div>
  );
}

export { Meter, surface };
