import { cn } from '@/lib/utils';
import { Slot } from 'radix-ui';
import * as React from 'react';

type Tile = {
  className?: string;
  glyph?: React.ReactNode;
  meta?: React.ReactNode;
  title: React.ReactNode;
};

function ShelfTile({
  className,
  glyph,
  link,
  meta,
  title,
  ...props
}: Tile &
  (
    | { link: (tile: React.ReactNode) => React.ReactElement }
    | (Omit<
        React.ComponentProps<'button'>,
        'children' | 'className' | 'title' | 'type'
      > & { link?: undefined })
  )) {
  const body = (
    <>
      {glyph ? (
        <span
          data-slot='shelf-tile-glyph'
          className="mt-0.5 flex size-4 shrink-0 items-center justify-center self-start text-muted-foreground [&_svg:not([class*='size-'])]:size-4"
        >
          {glyph}
        </span>
      ) : null}
      <span className='flex min-w-0 flex-col'>
        <span className='truncate font-medium'>{title}</span>
        {meta ? (
          <span className='truncate text-xs text-muted-foreground'>{meta}</span>
        ) : null}
      </span>
    </>
  );

  const classes = cn(
    'flex min-h-13 w-full min-w-0 items-center gap-3 rounded-menu px-3 py-2 text-left text-sm transition-colors hover:bg-muted',
    className
  );

  if (link) {
    return (
      <Slot.Root data-slot='shelf-tile' className={classes}>
        {link(body)}
      </Slot.Root>
    );
  }

  return (
    <button data-slot='shelf-tile' className={classes} type='button' {...props}>
      {body}
    </button>
  );
}

export { ShelfTile };
