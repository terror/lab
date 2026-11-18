import { glideOrigin } from '@/lib/glide';
import { useMediaQuery } from '@/lib/media';
import { fade, spring } from '@/lib/motion';
import { animate } from 'motion/react';
import { type ReactNode, useLayoutEffect, useRef, useState } from 'react';

export function ComposerDock({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const [origin] = useState(glideOrigin);
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  const dock = useRef<HTMLDivElement>(null);
  const glider = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const top = dock.current?.getBoundingClientRect().top;
    const element = glider.current;

    if (origin === undefined || top === undefined || !element) {
      return undefined;
    }

    if (reduced) {
      return animate(element, { opacity: [0, 1] }, fade.base).stop;
    }

    return animate(
      element,
      { transform: [`translateY(${origin - top}px)`, 'translateY(0px)'] },
      spring.glide
    ).stop;
  }, [origin, reduced]);

  return (
    <div ref={dock} className={className}>
      <div ref={glider}>{children}</div>
    </div>
  );
}
