import { useMaxFeatures } from '@/lib/motion';
import { LayoutGroup, LazyMotion, domAnimation } from 'motion/react';
import type { ReactNode } from 'react';

function LayoutScope({ children, id }: { children: ReactNode; id?: string }) {
  const features = useMaxFeatures();

  return (
    <LazyMotion features={features} strict>
      <LayoutGroup
        key={features === domAnimation ? 'loading' : 'loaded'}
        id={id}
      >
        {children}
      </LayoutGroup>
    </LazyMotion>
  );
}

export { LayoutScope };
