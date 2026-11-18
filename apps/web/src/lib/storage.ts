import { useCallback, useMemo, useSyncExternalStore } from 'react';
import type { z } from 'zod';

const prefix = 'lab:';

const userKey = `${prefix}user`;

let user: string | undefined;

const listeners = new Set<() => void>();

function subscribeStorage(listener: () => void) {
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

function scoped(key: string) {
  return `${prefix}${user}:${key}`;
}

function getItem(key: string) {
  return user === undefined ? null : window.localStorage.getItem(scoped(key));
}

export function setStorageUser(id: string) {
  if (window.localStorage.getItem(userKey) === null) {
    clearStored();
  }

  window.localStorage.setItem(userKey, JSON.stringify(id));
  user = id;
}

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

export function readStored<T>(key: string, schema: z.ZodType<T>, fallback: T) {
  return parse(getItem(key), schema, fallback);
}

export function writeStored(key: string, value: unknown) {
  if (user === undefined) {
    return;
  }

  window.localStorage.setItem(scoped(key), JSON.stringify(value));
  notify();
}

export function clearStored() {
  for (const key of Object.keys(window.localStorage)) {
    if (key.startsWith(prefix)) {
      window.localStorage.removeItem(key);
    }
  }

  notify();
}

export function removeStored(key: string) {
  window.localStorage.removeItem(scoped(key));
  notify();
}

export function usePersistentState<T>(
  key: string,
  schema: z.ZodType<T>,
  fallback: T
) {
  const raw = useSyncExternalStore(subscribeStorage, () => getItem(key));

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
