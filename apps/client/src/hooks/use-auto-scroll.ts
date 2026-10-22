import { useLayoutEffect, useRef, useState } from 'react';

export function useAutoScroll() {
  const container = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const following = useRef(true);

  const [showScrollButton, setShowScrollButton] = useState(false);

  useLayoutEffect(() => {
    const viewport = container.current;
    const transcript = content.current;

    if (!viewport || !transcript) {
      return;
    }

    const observer = new ResizeObserver(() => {
      if (following.current) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    });

    observer.observe(transcript);
    observer.observe(viewport);

    return () => observer.disconnect();
  }, []);

  function onScroll() {
    const viewport = container.current;

    if (!viewport) {
      return;
    }

    following.current =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 100;

    setShowScrollButton(!following.current);
  }

  function scrollToBottom() {
    following.current = true;

    setShowScrollButton(false);

    container.current?.scrollTo({
      top: container.current.scrollHeight,
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
    });
  }

  return { container, content, showScrollButton, onScroll, scrollToBottom };
}
