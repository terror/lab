import { useCallback, useMemo, useSyncExternalStore } from 'react';
import type { z } from 'zod';

const prefix = 'lab:';

const listeners = new Set<() => void>();

export function subscribeStorage(listener: () => void) {
  listeners.add(listener);
  window.addEventListener('storage', listener);

  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

function parse<T>(raw: string | null, schema: z.ZodType<T>, fallback: T) {
  if (raw === null) {
    return fallback;
  }

  try {
    return schema.safeParse(JSON.parse(raw)).data ?? fallback;
  } catch {
    return fallback;
  }
}

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

export function readStored<T>(key: string, schema: z.ZodType<T>, fallback: T) {
  return parse(window.localStorage.getItem(prefix + key), schema, fallback);
}

export function writeStored(key: string, value: unknown) {
  window.localStorage.setItem(prefix + key, JSON.stringify(value));
  notify();
}

export function removeStored(key: string) {
  window.localStorage.removeItem(prefix + key);
  notify();
}

export function usePersistentState<T>(
  key: string,
  schema: z.ZodType<T>,
  fallback: T
) {
  const raw = useSyncExternalStore(subscribeStorage, () =>
    window.localStorage.getItem(prefix + key)
  );

  const value = useMemo(
    () => parse(raw, schema, fallback),
    [raw, schema, fallback]
  );

  const setValue = useCallback(
    (next: T) => {
      if (next === fallback) {
        removeStored(key);
      } else {
        writeStored(key, next);
      }
    },
    [fallback, key]
  );

  return [value, setValue] as const;
}
