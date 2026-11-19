import { maxFeatures } from '@/lib/motion';
import { LayoutGroup, LazyMotion } from 'motion/react';
import type { ReactNode } from 'react';

function LayoutScope({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <LazyMotion features={maxFeatures()} strict>
      <LayoutGroup id={id}>{children}</LayoutGroup>
    </LazyMotion>
  );
}

export { LayoutScope };
