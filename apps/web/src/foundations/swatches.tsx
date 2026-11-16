export function Swatches({
  tokens,
}: {
  tokens: { description: string; name: string }[];
}) {
  return (
    <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
      {tokens.map(({ description, name }) => (
        <div key={name} className='flex items-center gap-3'>
          <span
            className='size-10 shrink-0 rounded-lg ring-1 ring-foreground/10'
            style={{ background: `var(--${name})` }}
          />
          <span className='flex min-w-0 flex-col'>
            <code className='text-xs'>{name}</code>
            <span className='text-xs text-muted-foreground'>{description}</span>
          </span>
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
