import { Card } from '@/components/ui/card';
import { type ReactNode, useId } from 'react';

export function NeedsYou({
  active,
  children,
  title,
}: {
  active: boolean;
  children: ReactNode;
  title: string;
}) {
  const id = useId();

  return (
    <fieldset aria-labelledby={id} className='min-w-0'>
      <Card className='gap-3 wrap-anywhere' variant='outline'>
        <div className='flex flex-col gap-1'>
          {active && (
            <p className='text-xs font-medium text-status-attention-ink'>
              Needs you
            </p>
          )}
          <p className='text-sm font-medium' id={id}>
            {title}
          </p>
        </div>
        {children}
      </Card>
    </fieldset>
  );
}
