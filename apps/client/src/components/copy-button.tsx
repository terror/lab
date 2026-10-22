import { Button } from '@/components/ui/button';
import { useCopy } from '@/hooks/use-copy';
import { Check, Copy } from 'lucide-react';

export function CopyButton({
  text,
  label = 'Copy message',
}: {
  text: string;
  label?: string;
}) {
  const { copied, copy } = useCopy();

  return (
    <Button
      variant='ghost'
      size='icon-sm'
      aria-label={copied ? 'Copied' : label}
      title={copied ? 'Copied' : label}
      className='text-muted-foreground'
      onClick={() => void copy(text)}
    >
      {copied ? <Check className='size-3.5' /> : <Copy className='size-3.5' />}
    </Button>
  );
}
