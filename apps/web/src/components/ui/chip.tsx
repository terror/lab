import { cn } from '@/lib/utils';
import * as React from 'react';

const tones = {
  done: 'bg-spark-yellow-wash text-spark-yellow-ink',
  neutral: 'bg-muted text-muted-foreground',
};

function Chip({
  className,
  tone,
  ...props
}: React.ComponentProps<'span'> & { tone: keyof typeof tones }) {
  return (
    <span
      data-slot='chip'
      data-tone={tone}
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-medium [&_svg:not([class*='size-'])]:size-3.5",
        tones[tone],
        className
      )}
      {...props}
    />
  );
}

export { Chip };
