import {
  type FeatureBundle,
  type Transition,
  domAnimation,
} from 'motion/react';
import { useEffect, useState } from 'react';

export const spring = {
  glide: { bounce: 0, type: 'spring', visualDuration: 0.3 },
  lively: { bounce: 0.15, type: 'spring', visualDuration: 0.35 },
  pop: { bounce: 0.3, type: 'spring', visualDuration: 0.45 },
  snap: { bounce: 0, type: 'spring', visualDuration: 0.18 },
} as const satisfies Record<string, Transition>;

const easeOut = [0.2, 0, 0, 1] as const;

const easeIn = [0.3, 0, 1, 1] as const;

export const fade = {
  base: { duration: 0.18, ease: easeOut },
  fast: { duration: 0.12, ease: easeOut },
  leave: { duration: 0.12, ease: easeIn },
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

let max: FeatureBundle | undefined;

async function loadMax() {
  const features = await import('./motion-max');

  max = features.default;

  return max;
}

export function useMaxFeatures() {
  const [state, setState] = useState(() => ({
    features: max ?? domAnimation,
    settled: max !== undefined,
  }));

  useEffect(() => {
    let live = true;

    loadMax().then(
      (features) => live && setState({ features, settled: true }),
      () => live && setState({ features: domAnimation, settled: true })
    );

    return () => {
      live = false;
    };
  }, []);

  return state;
}
