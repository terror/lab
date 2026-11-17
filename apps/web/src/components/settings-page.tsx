import type { ReactNode } from 'react';

export function SettingsPage({
  action,
  children,
  description,
  title,
}: {
  action?: ReactNode;
  children?: ReactNode;
  description: ReactNode;
  title: string;
}) {
  return (
    <section className='space-y-8'>
      <div className='flex items-start justify-between gap-4'>
        <div className='space-y-1'>
          <h1 className='text-2xl font-semibold tracking-tight'>{title}</h1>
          <p className='text-sm text-muted-foreground'>{description}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
