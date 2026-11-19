import { ListRow } from '@/components/ui/list-row';
import { cn } from '@/lib/utils';
import * as React from 'react';

function ActivityRow({
  actions,
  className,
  detail,
  glyph,
  link,
  meta,
  progress,
  time,
  title,
  ...props
}: Omit<React.ComponentProps<'li'>, 'children' | 'title'> & {
  actions?: React.ReactNode;
  detail?: React.ReactNode;
  glyph: React.ReactNode;
  link?: (row: React.ReactNode) => React.ReactElement;
  meta?: React.ReactNode;
  progress?: React.ReactNode;
  time?: React.ReactNode;
  title: React.ReactNode;
}) {
  const body = (
    <>
      <span
        data-slot='activity-row-glyph'
        className={cn(
          'flex size-4 shrink-0 items-center justify-center',
          detail !== undefined && 'mt-0.5 self-start'
        )}
      >
        {glyph}
      </span>
      <span className='flex min-w-0 flex-1 flex-col'>
        <span className='flex min-w-0 items-baseline gap-2'>
          <span className='truncate font-medium'>{title}</span>
          {meta && (
            <span className='min-w-0 shrink-10 truncate text-xs text-muted-foreground'>
              {meta}
            </span>
          )}
        </span>
        {detail !== undefined && (
          <span className='flex min-w-0 items-center gap-2 text-muted-foreground'>
            <span className='truncate'>{detail}</span>
            {progress}
          </span>
        )}
      </span>
    </>
  );

  return (
    <ListRow
      actions={
        actions && (
          <span className='flex min-w-16 justify-end pointer-coarse:min-w-0'>
            {actions}
          </span>
        )
      }
      asChild={link !== undefined}
      className={cn('[&_[data-slot=list-row-status]]:justify-end', className)}
      status={
        time !== undefined && (
          <span className='text-xs text-muted-foreground tabular-nums'>
            {time}
          </span>
        )
      }
      {...props}
    >
      {link ? link(body) : body}
    </ListRow>
  );
}

export { ActivityRow };
