import { cn } from '@/lib/utils';
import * as React from 'react';

const tones = {
  attention: 'bg-status-attention',
  done: 'bg-status-done',
  live: 'bg-status-live',
};

function Dot({
  className,
  tone,
  ...props
}: React.ComponentProps<'span'> & { tone: keyof typeof tones }) {
  return (
    <span
      aria-hidden='true'
      data-slot='dot'
      data-tone={tone}
      className={cn(
        'inline-block size-[7px] shrink-0 rounded-[2px]',
        tones[tone],
        className
      )}
      {...props}
    />
  );
}

export { Dot };
