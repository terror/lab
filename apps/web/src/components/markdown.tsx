import { Suspense, lazy } from 'react';
import type { StreamdownProps } from 'streamdown';

const Streamdown = lazy(async () => {
  const [{ Streamdown: Renderer }, { code }] = await Promise.all([
    import('streamdown'),
    import('@streamdown/code'),
  ]);

  const plugins = { code };

  return {
    default: (props: StreamdownProps) => (
      <Renderer plugins={plugins} {...props} />
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
  return (
    <Suspense fallback={<div className='whitespace-pre-wrap'>{children}</div>}>
      <Streamdown
        animated={
          streaming && { animation: 'fadeIn', duration: 240, sep: 'word' }
        }
        isAnimating={streaming}
      >
        {children}
      </Streamdown>
    </Suspense>
  );
}
