import { healthQueryOptions } from '@/lib/health';
import { cn } from '@/lib/utils';
import { type QueryStatus, useQuery } from '@tanstack/react-query';

const presentation = {
  pending: {
    label: 'Connecting',
    color: 'bg-muted-foreground motion-safe:animate-pulse',
  },
  error: { label: 'Disconnected', color: 'bg-destructive' },
  success: { label: 'Connected', color: 'bg-emerald-600' },
} satisfies Record<QueryStatus, { label: string; color: string }>;

export function ConnectionStatus() {
  const health = useQuery(healthQueryOptions);

  const { label, color } = presentation[health.status];

  return (
    <p
      role='status'
      className='ml-auto flex items-center gap-2 text-xs text-muted-foreground'
    >
      <span aria-hidden='true' className={cn('size-2 rounded-full', color)} />
      <span className='sr-only sm:not-sr-only'>{label}</span>
    </p>
  );
}
