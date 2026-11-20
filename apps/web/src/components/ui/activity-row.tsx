import { ListRow } from '@/components/ui/list-row';
import { cn } from '@/lib/utils';
import * as React from 'react';

function ActivityRow({
  actions,
  className,
  detail,
  glyph,
  label,
  meta,
  progress,
  renderLink,
  time,
  title,
  ...props
}: Omit<React.ComponentProps<'li'>, 'children' | 'title'> & {
  actions?: React.ReactNode;
  detail?: React.ReactNode;
  glyph: React.ReactNode;
  label?: string;
  meta?: React.ReactNode;
  progress?: React.ReactNode;
  renderLink?: (row: React.ReactNode) => React.ReactElement;
  time?: React.ReactNode;
  title: React.ReactNode;
}) {
  const second = Boolean(detail) || Boolean(progress);

  const when = time ? (
    <span className='text-xs whitespace-nowrap text-muted-foreground tabular-nums'>
      {time}
    </span>
  ) : undefined;

  const body = (
    <>
      <span
        data-slot='activity-row-glyph'
        className={cn(
          'flex size-4 shrink-0 items-center justify-center',
          second && 'mt-0.5 self-start'
        )}
      >
        {glyph}
      </span>
      <span className='flex min-w-0 flex-1 flex-col'>
        <span className='flex h-5 min-w-0 flex-wrap items-baseline gap-x-2 overflow-hidden'>
          <span className='max-w-full truncate font-medium'>{title}</span>
          {meta ? (
            <span className='text-xs whitespace-nowrap text-muted-foreground'>
              {meta}
            </span>
          ) : null}
          {label && <span className='sr-only'>{label}</span>}
        </span>
        {second && (
          <span className='flex min-w-0 items-center gap-2 text-muted-foreground'>
            {detail ? <span className='truncate'>{detail}</span> : null}
            {progress}
          </span>
        )}
      </span>
    </>
  );

  return (
    <ListRow
      actions={
        actions ? (
          <span className='grid justify-items-end *:col-start-1 *:row-start-1'>
            <span
              aria-hidden='true'
              className='invisible flex pointer-coarse:hidden'
            >
              {when}
            </span>
            <span className='flex'>{actions}</span>
          </span>
        ) : undefined
      }
      asChild={renderLink !== undefined}
      className={cn('[&_[data-slot=list-row-status]]:justify-end', className)}
      status={when}
      {...props}
    >
      {renderLink ? renderLink(body) : body}
    </ListRow>
  );
}

export { ActivityRow };
