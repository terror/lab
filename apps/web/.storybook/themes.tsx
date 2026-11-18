import type { ReactNode } from 'react';

export function themes(Story: () => ReactNode) {
  return (
    <div className='grid gap-4 sm:grid-cols-2'>
      <div className='rounded-card bg-background p-6 text-foreground ring-1 ring-foreground/10'>
        <Story />
      </div>
      <div className='dark rounded-card bg-background p-6 text-foreground ring-1 ring-foreground/10'>
        <Story />
      </div>
    </div>
  );
}
