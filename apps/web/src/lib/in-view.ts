import { useEffect, useState } from 'react';

export function useInView(element: Element | null) {
  const [seen, setSeen] = useState(true);

  useEffect(() => {
    if (!element) {
      return undefined;
    }

    const observer = new IntersectionObserver(([entry]) =>
      setSeen(entry?.isIntersecting ?? true)
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [element]);

  return element === null || seen;
}
