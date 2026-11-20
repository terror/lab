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
  meta,
  renderLink,
  title,
  ...props
}: Tile &
  (
    | { renderLink: (tile: React.ReactNode) => React.ReactElement }
    | (Omit<
        React.ComponentProps<'button'>,
        'children' | 'className' | 'title' | 'type'
      > & { renderLink?: undefined })
  )) {
  const mark = glyph ? (
    <span
      data-slot='shelf-tile-glyph'
      className={cn(
        "flex size-4 shrink-0 items-center justify-center text-muted-foreground [&_svg:not([class*='size-'])]:size-4",
        Boolean(meta) && 'mt-0.5 self-start'
      )}
    >
      {glyph}
    </span>
  ) : null;

  const words = (
    <span className='flex min-w-0 flex-col'>
      <span className='truncate font-medium'>{title}</span>
      {meta ? (
        <span className='truncate text-xs text-muted-foreground'>{meta}</span>
      ) : null}
    </span>
  );

  const classes = cn(
    'flex min-h-13 w-full min-w-0 items-center gap-3 rounded-menu px-3 py-2 text-left text-sm transition-colors hover:bg-muted',
    className
  );

  if (renderLink) {
    return (
      <Slot.Root data-slot='shelf-tile' className={classes}>
        {renderLink(
          <>
            {mark}
            {words}
          </>
        )}
      </Slot.Root>
    );
  }

  return (
    <button data-slot='shelf-tile' className={classes} type='button' {...props}>
      {mark}
      {words}
    </button>
  );
}

export { ShelfTile };
