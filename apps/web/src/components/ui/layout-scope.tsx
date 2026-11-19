import { useMaxFeatures } from '@/lib/motion';
import { LayoutGroup, LazyMotion } from 'motion/react';
import type { ReactNode } from 'react';

function LayoutScope({ children, id }: { children: ReactNode; id?: string }) {
  const { features, settled } = useMaxFeatures();

  if (!settled) {
    return null;
  }

  return (
    <LazyMotion features={features} strict>
      <LayoutGroup id={id}>{children}</LayoutGroup>
    </LazyMotion>
  );
}

export { LayoutScope };
