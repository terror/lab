import { useEffect, useRef } from 'react';

export function LoadMore({ onLoadMore }: { onLoadMore: () => void }) {
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = sentinel.current;

    if (!element) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          onLoadMore();
        }
      },
      { rootMargin: '400px' }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [onLoadMore]);

  return <div ref={sentinel} className='h-px shrink-0' />;
}
