import { useEffect, useState } from 'react';

const AHEM_MS = 8_000;

export function useKeptWaiting(call: string | undefined) {
  const [kept, setKept] = useState<string>();

  useEffect(() => {
    if (call === undefined) {
      return undefined;
    }

    let timer: number | undefined;

    const arm = () => {
      window.clearTimeout(timer);

      if (document.visibilityState === 'visible') {
        timer = window.setTimeout(() => setKept(call), AHEM_MS);
      }
    };

    arm();
    document.addEventListener('visibilitychange', arm);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', arm);
    };
  }, [call]);

  return call !== undefined && kept === call;
}
