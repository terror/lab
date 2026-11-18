import type { Transition } from 'motion/react';

export const spring = {
  glide: { bounce: 0, type: 'spring', visualDuration: 0.3 },
  lively: { bounce: 0.15, type: 'spring', visualDuration: 0.35 },
  pop: { bounce: 0.3, type: 'spring', visualDuration: 0.45 },
  snap: { bounce: 0, type: 'spring', visualDuration: 0.18 },
} as const satisfies Record<string, Transition>;

const easeOut = [0.2, 0, 0, 1] as const;

export const fade = {
  base: { duration: 0.18, ease: easeOut },
  fast: { duration: 0.12, ease: easeOut },
} as const satisfies Record<string, Transition>;

export const stagger = 0.03;

export function rise(index: number) {
  const delay = Math.min(index, 5) * stagger;

  return {
    animate: { opacity: 1, y: 0 },
    initial: { opacity: 0, y: 4 },
    transition: { ...spring.snap, delay, opacity: { ...fade.base, delay } },
  } as const;
}
