import { stagger } from '@/lib/motion';
import { cn } from '@/lib/utils';
import * as React from 'react';

const grains = [
  { size: 3, x: 4, y: 30 },
  { size: 2, x: 12, y: 62 },
  { size: 2, x: 21, y: 40 },
  { size: 3, x: 29, y: 70 },
  { size: 2, x: 37, y: 28 },
  { size: 3, x: 46, y: 55 },
  { size: 2, x: 54, y: 35 },
  { size: 2, x: 62, y: 68 },
  { size: 3, x: 70, y: 42 },
  { size: 2, x: 79, y: 60 },
  { size: 3, x: 87, y: 32 },
  { size: 2, x: 95, y: 52 },
];

function Dissolve({
  active,
  children,
  className,
  order = 0,
}: {
  active: boolean;
  children: React.ReactNode;
  className?: string;
  order?: number;
}) {
  const delay = Math.min(order, 5) * stagger;

  return (
    <span
      data-active={active || undefined}
      data-slot='dissolve'
      className='group/dissolve relative flex min-w-0 flex-1'
      style={{ '--dissolve-delay': `${delay}s` } as React.CSSProperties}
    >
      <span
        className={cn(
          'flex min-w-0 flex-1 group-data-active/dissolve:animate-dissolve-wipe motion-reduce:animate-none',
          className
        )}
      >
        {children}
      </span>
      {active &&
        grains.map(({ size, x, y }) => (
          <span
            key={x}
            aria-hidden='true'
            className='pointer-events-none absolute animate-dissolve-grain bg-muted-foreground motion-reduce:hidden'
            style={{
              animationDelay: `calc(var(--dissolve-delay) + var(--motion-slow) * ${x / 100})`,
              height: size,
              left: `${x}%`,
              top: `${y}%`,
              width: size,
            }}
          />
        ))}
    </span>
  );
}

export { Dissolve };
