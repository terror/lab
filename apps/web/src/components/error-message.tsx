import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

export function ErrorMessage({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p role='alert' className={cn('text-sm text-destructive', className)}>
      {children}
    </p>
  );
}
