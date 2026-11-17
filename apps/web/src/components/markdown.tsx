import { useLineNumbers } from '@/lib/preferences';
import { Suspense, lazy } from 'react';
import type { StreamdownProps } from 'streamdown';

const Streamdown = lazy(async () => {
  const [{ Streamdown: Renderer }, { code }] = await Promise.all([
    import('streamdown'),
    import('@streamdown/code'),
  ]);

  const plugins = { code };

  const linkSafety = { enabled: false };

  return {
    default: (props: StreamdownProps) => (
      <Renderer linkSafety={linkSafety} plugins={plugins} {...props} />
    ),
  };
});

export function Markdown({
  children,
  streaming,
}: {
  children: string;
  streaming: boolean;
}) {
  const [lineNumbers] = useLineNumbers();

  return (
    <Suspense fallback={<div className='whitespace-pre-wrap'>{children}</div>}>
      <Streamdown
        animated={
          streaming && { animation: 'fadeIn', duration: 240, sep: 'word' }
        }
        isAnimating={streaming}
        lineNumbers={lineNumbers}
      >
        {children}
      </Streamdown>
    </Suspense>
  );
}
