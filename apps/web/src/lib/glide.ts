import { useState } from 'react';

let origin: number | undefined;

export function holdGlide(top: number) {
  origin = top;

  return () => {
    origin = undefined;
  };
}

export function glideOrigin() {
  return origin;
}

export function useArrivals(keys: string[], ready: boolean) {
  const [glided] = useState(() => origin !== undefined);
  const [initial, setInitial] = useState<Set<string>>();

  if (ready && initial === undefined) {
    setInitial(new Set(glided ? [] : keys));
  }

  return (key: string) => initial !== undefined && !initial.has(key);
}
