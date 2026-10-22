import { useTheme } from '@/hooks/use-theme';
import {
  CircleCheck,
  Info,
  LoaderCircle,
  OctagonX,
  TriangleAlert,
} from 'lucide-react';
import type { CSSProperties } from 'react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

export function Toaster(props: ToasterProps) {
  const { theme } = useTheme();

  return (
    <Sonner
      theme={theme}
      className='toaster group'
      position='bottom-right'
      closeButton
      duration={6_000}
      icons={{
        success: <CircleCheck className='size-4' />,
        info: <Info className='size-4' />,
        warning: <TriangleAlert className='size-4' />,
        error: <OctagonX className='size-4 text-destructive' />,
        loading: <LoaderCircle className='size-4 motion-safe:animate-spin' />,
      }}
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
          '--border-radius': 'var(--radius)',
          '--toast-close-button-start': 'unset',
          '--toast-close-button-end': '0',
          '--toast-close-button-transform': 'translate(35%, -35%)',
        } as CSSProperties
      }
      toastOptions={{ classNames: { toast: 'cn-toast' } }}
      {...props}
    />
  );
}
