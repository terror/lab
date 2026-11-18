import { formatBytes } from '@/lib/format';
import { cn } from '@/lib/utils';
import { FileText } from 'lucide-react';

const chip =
  'flex max-w-full items-center gap-2 self-start rounded-card bg-foreground/4 px-3 py-2 text-sm';

export function FileChip({
  href,
  name,
  size,
}: {
  href?: string;
  name: string;
  size?: number;
}) {
  const content = (
    <>
      <FileText
        aria-hidden='true'
        className='size-4 shrink-0 text-muted-foreground'
      />
      <span className='min-w-0 truncate'>{name}</span>
      {size !== undefined && (
        <span className='shrink-0 text-xs text-muted-foreground tabular-nums'>
          {formatBytes(size)}
        </span>
      )}
    </>
  );

  if (!href) {
    return <span className={chip}>{content}</span>;
  }

  return (
    <a
      className={cn(chip, 'transition-colors hover:bg-muted')}
      download={name}
      href={href}
    >
      {content}
    </a>
  );
}
