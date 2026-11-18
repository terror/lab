import { ListRow } from '@/components/ui/list-row';
import type { ReactNode } from 'react';

export function SettingRow({
  control,
  description,
  htmlFor,
  label,
}: {
  control: ReactNode;
  description?: ReactNode;
  htmlFor?: string;
  label: string;
}) {
  const text = (
    <span className='flex min-w-0 flex-1 flex-col gap-0.5'>
      <span className='font-medium'>{label}</span>
      {description && (
        <span className='text-muted-foreground'>{description}</span>
      )}
    </span>
  );

  if (!htmlFor) {
    return (
      <ListRow className='hover:bg-transparent'>
        {text}
        {control}
      </ListRow>
    );
  }

  return (
    <ListRow asChild>
      <label htmlFor={htmlFor}>
        {text}
        {control}
      </label>
    </ListRow>
  );
}
