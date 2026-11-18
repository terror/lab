import { cn } from '@/lib/utils';
import { useLayoutEffect, useRef, useState } from 'react';

import { contrast } from './contrast';

type Token = { description: string; name: string; pair?: string };

const themes = [
  { label: 'Light', name: 'light' },
  { label: 'Dark', name: 'dark' },
];

function Swatch({ description, name, pair }: Token) {
  const ref = useRef<HTMLDivElement>(null);
  const [read, setRead] = useState<{ ratio?: number; value: string }>();

  useLayoutEffect(() => {
    if (!ref.current) {
      return;
    }

    const style = getComputedStyle(ref.current);
    const value = style.getPropertyValue(`--${name}`);

    setRead({
      ratio: pair
        ? contrast(value, style.getPropertyValue(`--${pair}`))
        : undefined,
      value,
    });
  }, [name, pair]);

  return (
    <div ref={ref} className='flex items-center gap-3'>
      <span
        className='size-10 shrink-0 rounded-control ring-1 ring-foreground/10'
        style={{ background: `var(--${name})` }}
      />
      <span className='flex min-w-0 flex-col'>
        <code className='text-xs'>{name}</code>
        <code className='truncate text-xs text-muted-foreground'>
          {read?.value}
        </code>
        <span className='text-xs text-muted-foreground'>
          {description}
          {read?.ratio && ` ${read.ratio.toFixed(2)}:1 against ${pair}.`}
        </span>
      </span>
    </div>
  );
}

export function Swatches({ tokens }: { tokens: Token[] }) {
  return (
    <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
      {themes.map((theme) => (
        <div
          key={theme.name}
          className={cn(
            theme.name,
            'flex flex-col gap-4 rounded-card bg-background p-4 text-foreground ring-1 ring-foreground/10'
          )}
        >
          <span className='text-xs font-medium text-muted-foreground'>
            {theme.label}
          </span>
          {tokens.map((token) => (
            <Swatch key={token.name} {...token} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function Sample({
  className,
  label,
  text,
}: {
  className: string;
  label: string;
  text: string;
}) {
  return (
    <div className='flex items-baseline gap-6 py-2'>
      <code className='w-40 shrink-0 text-xs text-muted-foreground'>
        {label}
      </code>
      <span className={className}>{text}</span>
    </div>
  );
}
