import { useTheme } from '@/lib/theme';
import type { CSSProperties } from 'react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

function Toaster(props: ToasterProps) {
  const [theme] = useTheme();

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
      theme={theme}
      {...props}
    />
  );
}

export { Toaster };
