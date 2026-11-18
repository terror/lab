import { Dot } from '@/components/ui/dot';
import { cn } from '@/lib/utils';
import { Ban, Check, type LucideIcon, X } from 'lucide-react';

const icons: Record<'done' | 'failed' | 'stopped', LucideIcon> = {
  done: Check,
  failed: X,
  stopped: Ban,
};

function StatusIcon({
  className,
  status,
}: {
  className?: string;
  status: 'done' | 'failed' | 'running' | 'stopped';
}) {
  if (status === 'running') {
    return <Dot className={className} tone='live' />;
  }

  const Icon = icons[status];

  return (
    <Icon
      aria-hidden='true'
      className={cn(
        'size-4 shrink-0',
        status === 'failed' && 'text-destructive',
        className
      )}
      data-slot='status-icon'
      data-status={status}
    />
  );
}

export { StatusIcon };
