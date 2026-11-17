import { cn } from '@/lib/utils';

export function LoadError({
  className,
  subject,
}: {
  className?: string;
  subject: string;
}) {
  return (
    <p role='alert' className={cn('text-sm text-destructive', className)}>
      Unable to load {subject}.
    </p>
  );
}
