import { useEffect, useState } from 'react';

const AHEM_MS = 8_000;

const ANSWER_MS = 640;

const ahemed = new Set<string>();

export function useAhem(callId: string, waiting: boolean) {
  const [cleared, setCleared] = useState<string>();

  useEffect(() => {
    if (!waiting || ahemed.has(callId)) {
      return undefined;
    }

    let timer: number | undefined;

    const arm = () => {
      window.clearTimeout(timer);

      if (document.visibilityState === 'visible') {
        timer = window.setTimeout(() => {
          ahemed.add(callId);
          setCleared(callId);
        }, AHEM_MS);
      }
    };

    arm();
    document.addEventListener('visibilitychange', arm);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', arm);
    };
  }, [callId, waiting]);

  return waiting && cleared === callId;
}

function gesture(answered: boolean, denied: boolean) {
  if (!answered) {
    return undefined;
  }

  return denied ? 'drift' : 'gulp';
}

export function useAnswer(waiting: boolean, denied: boolean) {
  const [was, setWas] = useState(waiting);
  const [answer, setAnswer] = useState<'drift' | 'gulp'>();

  if (was !== waiting) {
    setWas(waiting);
    setAnswer(gesture(was, denied));
  }

  useEffect(() => {
    if (answer === undefined) {
      return undefined;
    }

    const timer = window.setTimeout(() => setAnswer(undefined), ANSWER_MS);

    return () => window.clearTimeout(timer);
  }, [answer]);

  return answer;
}
