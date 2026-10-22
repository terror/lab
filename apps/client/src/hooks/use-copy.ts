import { notifyError } from '@/lib/errors';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

export function useCopy() {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);

      setCopied(true);
      toast.success('Copied to clipboard', {
        id: 'clipboard',
        duration: 2_000,
      });
    } catch {
      setCopied(false);
      notifyError(new Error('Unable to copy to clipboard.'), {
        id: 'clipboard',
      });
    }

    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2_000);
  }

  return { copied, copy };
}
