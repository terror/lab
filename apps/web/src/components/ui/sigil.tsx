import { SIDE, sigil } from '@/lib/sigil';
import { cn } from '@/lib/utils';
import * as React from 'react';

const sizes = {
  lg: { box: 40, cell: 8, gap: 5 },
  md: { box: 20, cell: 4, gap: 3 },
  sm: { box: 16, cell: 3, gap: 2 },
};

function frame(box: number) {
  const side = box - 2;

  return [
    `M1 0h${side}v1h-${side}z`,
    `M1 ${box - 1}h${side}v1h-${side}z`,
    `M0 1h1v${side}h-1z`,
    `M${box - 1} 1h1v${side}h-1z`,
  ].join('');
}

function Sigil({
  className,
  filled,
  kind,
  seed,
  size = 'sm',
  ...props
}: Omit<React.ComponentProps<'svg'>, 'children'> & {
  filled?: number;
  kind: 'app' | 'project';
  seed: string;
  size?: keyof typeof sizes;
}) {
  const lit = React.useMemo(() => sigil(seed), [seed]);

  const { cell, gap } = sizes[size];

  const framed = kind === 'project';

  const box = framed ? cell * SIDE + (gap + 1) * 2 : sizes[size].box;

  const inset = (box - cell * SIDE) / 2;

  return (
    <svg
      aria-hidden='true'
      data-kind={kind}
      data-slot='sigil'
      className={cn('shrink-0', className)}
      fill='currentColor'
      height={box}
      shapeRendering='crispEdges'
      viewBox={`0 0 ${box} ${box}`}
      width={box}
      {...props}
    >
      {framed && <path d={frame(box)} data-part='frame' />}
      {lit.map((at, index) => (
        <rect
          key={at}
          className='transition-opacity duration-base motion-reduce:transition-none'
          height={cell}
          opacity={filled === undefined || index < filled ? 1 : 0}
          width={cell}
          x={inset + (at % SIDE) * cell}
          y={inset + Math.floor(at / SIDE) * cell}
        />
      ))}
    </svg>
  );
}

export { Sigil };
