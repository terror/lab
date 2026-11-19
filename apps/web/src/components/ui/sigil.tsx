import { SIDE, sigil } from '@/lib/sigil';
import { cn } from '@/lib/utils';
import * as React from 'react';

const sizes = {
  lg: { box: 40, cell: 8, gap: 5 },
  md: { box: 20, cell: 4, gap: 3 },
  sm: { box: 16, cell: 3, gap: 2 },
};

type Face =
  | { kind: 'app'; seed: `app:${string}:${string}` }
  | { kind: 'project'; seed: `project:${string}` };

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
  style,
  ...props
}: Omit<React.ComponentProps<'svg'>, 'children'> &
  Face & {
    filled?: number;
    size?: keyof typeof sizes;
  }) {
  const cells = React.useMemo(() => {
    const pairs = sigil(seed);

    return pairs.flatMap((pair, index) =>
      pair.map((at) => ({ at, before: pairs.slice(0, index).flat().length }))
    );
  }, [seed]);

  const { cell, gap, ...bare } = sizes[size];

  const framed = kind === 'project';

  const box = framed ? cell * SIDE + (gap + 1) * 2 : bare.box;

  const inset = (box - cell * SIDE) / 2;

  return (
    <svg
      aria-hidden='true'
      data-kind={kind}
      data-slot='sigil'
      className={cn(
        'shrink-0 overflow-visible forced-colors:text-[CanvasText]',
        className
      )}
      fill='currentColor'
      shapeRendering='crispEdges'
      style={{ height: box, width: box, ...style }}
      viewBox={`0 0 ${box} ${box}`}
      {...props}
    >
      {framed && <path d={frame(box)} data-part='frame' />}
      {cells.map(({ at, before }) => (
        <rect
          key={at}
          className='transition-opacity duration-base motion-reduce:transition-none'
          height={cell}
          opacity={filled === undefined || before < filled ? 1 : 0}
          width={cell}
          x={inset + (at % SIDE) * cell}
          y={inset + Math.floor(at / SIDE) * cell}
        />
      ))}
    </svg>
  );
}

export { Sigil };
