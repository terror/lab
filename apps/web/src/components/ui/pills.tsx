import { cn } from '@/lib/utils';

function Pills<T extends string>({
  className,
  disabled,
  label,
  onValueChange,
  options,
  value,
}: {
  className?: string;
  disabled?: boolean;
  label: string;
  onValueChange: (value: T) => void;
  options: readonly { count?: number; label: string; value: T }[];
  value: T;
}) {
  return (
    <fieldset
      data-slot='pills'
      disabled={disabled}
      className={cn('flex min-w-0 items-center gap-1', className)}
    >
      <legend className='sr-only'>{label}</legend>
      {options.map((option) => (
        <button
          key={option.value}
          aria-pressed={option.value === value}
          className='hit-area relative flex h-7 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm whitespace-nowrap text-muted-foreground transition-colors duration-fast hover:bg-muted hover:text-foreground disabled:opacity-50 aria-pressed:bg-muted aria-pressed:font-medium aria-pressed:text-foreground'
          onClick={() => onValueChange(option.value)}
          type='button'
        >
          {option.label}
          {option.count !== undefined && (
            <span className='font-normal text-muted-foreground tabular-nums'>
              {option.count}
            </span>
          )}
        </button>
      ))}
    </fieldset>
  );
}

export { Pills };
