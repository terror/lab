import { useDark } from '@/lib/theme';
import type { CSSProperties } from 'react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

function Toaster(props: ToasterProps) {
  const dark = useDark();

  return (
    <Sonner
      className='group'
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-border': 'var(--border)',
          '--normal-text': 'var(--popover-foreground)',
        } as CSSProperties
      }
      theme={dark ? 'dark' : 'light'}
      {...props}
    />
  );
}

export { Toaster };
