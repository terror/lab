import { CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { ChevronRightIcon } from 'lucide-react';
import * as React from 'react';

function Separator({ className }: { className?: string }) {
  return (
    <span
      data-slot='run-line-separator'
      aria-hidden='true'
      className={cn('shrink-0 text-muted-foreground/70', className)}
    >
      ·
    </span>
  );
}

function RunLine({
  children,
  className,
  mark,
  stall = 0,
  style,
  ...props
}: React.ComponentProps<'div'> & { mark?: React.ReactNode; stall?: number }) {
  return (
    <div
      data-slot='run-line'
      data-stalled={stall > 0 || undefined}
      className={cn(
        'flex min-w-0 items-center gap-2 text-sm text-muted-foreground',
        className
      )}
      style={{ '--stall': stall, ...style } as React.CSSProperties}
      {...props}
    >
      {mark && (
        <span
          data-slot='run-line-mark'
          aria-hidden='true'
          className='flex size-4 shrink-0 items-center justify-center'
        >
          {mark}
        </span>
      )}
      <div
        data-slot='run-line-row'
        className='@container relative flex h-6.5 min-w-0 flex-1 items-center gap-x-1 overflow-hidden whitespace-nowrap'
      >
        {children}
      </div>
    </div>
  );
}

function RunLineVerb({
  className,
  live = false,
  tick = false,
  ...props
}: React.ComponentProps<'span'> & { live?: boolean; tick?: boolean }) {
  return (
    <span
      data-slot='run-line-verb'
      data-live={live || undefined}
      data-tick={tick || undefined}
      className={cn(
        'min-w-12 truncate data-live:shimmer data-live:shimmer-color-foreground motion-reduce:shimmer-none',
        className
      )}
      {...props}
    />
  );
}

function RunLineTime({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <>
      <Separator />
      <span
        data-slot='run-line-time'
        role='timer'
        className={cn('shrink-0 tabular-nums', className)}
        {...props}
      />
    </>
  );
}

function RunLineNote({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <>
      <Separator />
      <span
        data-slot='run-line-note'
        className={cn('min-w-0 truncate', className)}
        {...props}
      />
    </>
  );
}

function RunLineSummary({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <>
      <Separator className='hidden @md:inline' />
      <span
        data-slot='run-line-summary'
        className={cn(
          'hidden min-w-0 shrink-10000 truncate @md:inline',
          className
        )}
        {...props}
      />
    </>
  );
}

function RunLineToggle({
  children,
  className,
  compact = false,
  lead = false,
  ...props
}: Omit<React.ComponentProps<typeof CollapsibleTrigger>, 'asChild'> & {
  compact?: boolean;
  lead?: boolean;
}) {
  return (
    <>
      {!lead && <Separator className={cn(compact && 'hidden @sm:inline')} />}
      <CollapsibleTrigger
        data-slot='run-line-toggle'
        className={cn(
          'cursor-pointer text-left transition-colors after:absolute after:inset-0 hover:text-foreground',
          lead ? 'min-w-12 shrink-100' : 'shrink-0',
          className
        )}
        {...props}
      >
        <span
          className={cn('block truncate', compact && 'sr-only @sm:not-sr-only')}
        >
          {children}
        </span>
      </CollapsibleTrigger>
    </>
  );
}

function RunLineLink({
  className,
  detail = false,
  tone,
  ...props
}: React.ComponentProps<'button'> & { detail?: boolean; tone?: 'error' }) {
  return (
    <>
      <Separator className={cn(detail && 'hidden @sm:inline')} />
      <button
        data-slot='run-line-link'
        data-tone={tone}
        className={cn(
          'relative shrink-0 cursor-pointer rounded-control underline-offset-4 focus-ring-inset transition-colors hover:text-foreground hover:underline data-[tone=error]:text-destructive',
          detail && 'hidden @sm:inline',
          className
        )}
        type='button'
        {...props}
      />
    </>
  );
}

function RunLineChevron({
  className,
  open,
}: {
  className?: string;
  open: boolean;
}) {
  return (
    <ChevronRightIcon
      data-slot='run-line-chevron'
      aria-hidden='true'
      className={cn(
        'size-4 shrink-0 transition-transform',
        open && 'rotate-90',
        className
      )}
    />
  );
}

function RunTab({ className, ...props }: React.ComponentProps<'button'>) {
  return (
    <button
      data-slot='run-tab'
      className={cn(
        'flex h-8 max-w-full min-w-0 cursor-pointer items-center rounded-t-card border border-b-0 bg-background px-3 text-left transition-colors hover:bg-muted',
        className
      )}
      type='button'
      {...props}
    />
  );
}

export {
  RunLine,
  RunLineChevron,
  RunLineLink,
  RunLineNote,
  RunLineSummary,
  RunLineTime,
  RunLineToggle,
  RunLineVerb,
  RunTab,
};
