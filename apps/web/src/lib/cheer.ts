import { useEffect, useState } from 'react';

const QUICK_MS = 10_000;

const LONG_MS = 120_000;

const LONG_STEPS = 8;

export function cheerFor(worked: number, steps: number) {
  if (worked < QUICK_MS) {
    return 'idle';
  }

  return worked >= LONG_MS || steps >= LONG_STEPS ? 'proud' : 'done';
}

export function useCheer(working: boolean) {
  const [was, setWas] = useState(working);
  const [phase, setPhase] = useState<'cheer' | 'held' | 'rest'>('rest');

  if (was !== working) {
    setWas(working);
    setPhase(was ? 'held' : 'rest');
  }

  useEffect(() => {
    if (phase !== 'held') {
      return undefined;
    }

    const release = () => {
      if (document.visibilityState === 'visible') {
        setPhase('cheer');
      }
    };

    release();
    document.addEventListener('visibilitychange', release);

    return () => document.removeEventListener('visibilitychange', release);
  }, [phase]);

  return working ? 'working' : phase;
}
