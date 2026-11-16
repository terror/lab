import { Suspense, lazy } from 'react';

const Streamdown = lazy(async () => ({
  default: (await import('streamdown')).Streamdown,
}));

export function Markdown({
  children,
  streaming,
}: {
  children: string;
  streaming: boolean;
}) {
  return (
    <Suspense fallback={<div className='whitespace-pre-wrap'>{children}</div>}>
      <Streamdown isAnimating={streaming}>{children}</Streamdown>
    </Suspense>
  );
}
