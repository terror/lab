import {
  type SetStateAction,
  useCallback,
  useMemo,
  useSyncExternalStore,
} from 'react';
import type { z } from 'zod';

type StorageKind = 'local' | 'session';

type StorageKey = {
  key: string;
  storage?: StorageKind;
};

export type PersistedStateOptions<Value> = StorageKey & {
  defaultValue: NoInfer<Value>;
  schema: z.ZodType<Value>;
  format?: 'json' | 'text';
};

type StoredValue = { value: string | null; persisted: boolean };

const cache = {
  local: new Map<string, StoredValue>(),
  session: new Map<string, StoredValue>(),
};

const listeners = new Set<() => void>();

function getStorage(storage: StorageKind) {
  return storage === 'local' ? window.localStorage : window.sessionStorage;
}

function readStorage({ key, storage = 'local' }: StorageKey) {
  const cached = cache[storage].get(key);

  if (cached && !cached.persisted) {
    return cached.value;
  }

  try {
    const value = getStorage(storage).getItem(key);
    cache[storage].set(key, { value, persisted: true });

    return value;
  } catch {
    return cached?.value ?? null;
  }
}

function writeStorage(
  { key, storage = 'local' }: StorageKey,
  value: string | null
) {
  try {
    if (value === null) {
      getStorage(storage).removeItem(key);
    } else {
      getStorage(storage).setItem(key, value);
    }

    cache[storage].set(key, { value, persisted: true });
  } catch {
    cache[storage].set(key, { value, persisted: false });
  }

  notify();
}

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

function onStorage(event: StorageEvent) {
  for (const storage of ['local', 'session'] as const) {
    try {
      if (event.storageArea !== getStorage(storage)) {
        continue;
      }

      if (event.key === null) {
        cache[storage].clear();
      } else {
        cache[storage].delete(event.key);
      }
    } catch {
      continue;
    }
  }

  notify();
}

function subscribe(listener: () => void) {
  if (listeners.size === 0) {
    window.addEventListener('storage', onStorage);
  }

  listeners.add(listener);

  return () => {
    listeners.delete(listener);

    if (listeners.size === 0) {
      window.removeEventListener('storage', onStorage);
    }
  };
}

function deserialize<Value>(
  raw: string | null,
  options: PersistedStateOptions<Value>
): Value {
  if (raw === null) {
    return options.defaultValue;
  }

  try {
    return options.schema.parse(
      options.format === 'text' ? raw : JSON.parse(raw)
    );
  } catch {
    return options.defaultValue;
  }
}

export function setPersistedState<Value>(
  options: PersistedStateOptions<Value>,
  action: SetStateAction<Value>
) {
  const value =
    typeof action === 'function'
      ? (action as (previous: Value) => Value)(
          deserialize(readStorage(options), options)
        )
      : action;

  if (value === undefined) {
    resetPersistedState(options);
    return;
  }

  const raw = options.format === 'text' ? String(value) : JSON.stringify(value);
  writeStorage(options, raw);
}

export function resetPersistedState(options: StorageKey) {
  writeStorage(options, null);
}

export function usePersistedState<Value>({
  key,
  defaultValue,
  schema,
  storage = 'local',
  format = 'json',
}: PersistedStateOptions<Value>) {
  const options = useMemo(
    () => ({ key, defaultValue, schema, storage, format }),
    [key, defaultValue, schema, storage, format]
  );

  const getSnapshot = useCallback(() => readStorage(options), [options]);
  const raw = useSyncExternalStore(subscribe, getSnapshot, () => null);
  const value = useMemo(() => deserialize(raw, options), [raw, options]);

  const setValue = useCallback(
    (action: SetStateAction<Value>) => setPersistedState(options, action),
    [options]
  );

  const reset = useCallback(() => resetPersistedState(options), [options]);

  return [value, setValue, reset] as const;
}
