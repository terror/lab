import { useEffect, useRef, useState } from 'react';

export function useSteady<T>(value: T, hold: number) {
  const [shown, setShown] = useState(value);
  const since = useRef(0);

  useEffect(() => {
    since.current = Date.now();
  }, []);

  useEffect(() => {
    if (Object.is(value, shown)) {
      return undefined;
    }

    const timer = setTimeout(
      () => {
        since.current = Date.now();
        setShown(value);
      },
      Math.max(0, since.current + hold - Date.now())
    );

    return () => clearTimeout(timer);
  }, [hold, shown, value]);

  return shown;
}
