import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { modelsQueryOptions } from '@/lib/models';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react';

export function ModelPicker({
  disabled,
  onChange,
  value,
}: {
  disabled?: boolean;
  onChange: (model: string) => void;
  value: string | undefined;
}) {
  const models = useQuery(modelsQueryOptions);

  const options = models.data ?? [];

  const name = options.find(({ id }) => id === value)?.name ?? value;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className='rounded-full text-muted-foreground'
          disabled={disabled || options.length === 0}
          size='sm'
          type='button'
          variant='ghost'
        >
          {name ?? 'Model'}
          <ChevronDown aria-hidden='true' />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='min-w-48'>
        <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
          {options.map(({ id, name: label }) => (
            <DropdownMenuRadioItem key={id} value={id}>
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
