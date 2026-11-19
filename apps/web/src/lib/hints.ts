import {
  type QueryClient,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useCallback, useEffect, useSyncExternalStore } from 'react';

import { call, client } from './client';
import { preferencesQueryOptions } from './preferences';
import { useQuiet } from './voice';

const NOTE_MS = 12_000;

type Note = { id: string; retire: () => void };

type Session = {
  confirmed: boolean;
  done: boolean;
  note?: Note;
  taught?: string;
  until?: number;
};

let session: Session = { confirmed: false, done: false };

const listeners = new Set<() => void>();

function update(change: Partial<Session>) {
  session = { ...session, ...change };

  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

function useSession() {
  return useSyncExternalStore(subscribe, () => session);
}

function subscribeVisibility(listener: () => void) {
  document.addEventListener('visibilitychange', listener);

  return () => document.removeEventListener('visibilitychange', listener);
}

function useVisible() {
  return useSyncExternalStore(
    subscribeVisibility,
    () => document.visibilityState === 'visible'
  );
}

export function useLedger() {
  const { data, isPlaceholderData, isSuccess } = useQuery(
    preferencesQueryOptions
  );

  return {
    loaded: isSuccess && !isPlaceholderData,
    seen: data?.hints ?? [],
  };
}

async function claim(id: string, queryClient: QueryClient) {
  update({ taught: id });

  try {
    const { fresh, preferences } = await call(
      client.preferences.hints.$post({ json: { id } })
    );

    queryClient.setQueryData(preferencesQueryOptions.queryKey, preferences);

    update(fresh ? { confirmed: true } : { taught: undefined });
  } catch {
    update({ done: true });
  }
}

function retireTaught(id: string) {
  if (session.taught === id) {
    update({ done: true });
  }
}

export function useHint(id: string, eligible: boolean) {
  const queryClient = useQueryClient();
  const quiet = useQuiet();
  const { loaded, seen } = useLedger();
  const { confirmed, done, taught } = useSession();
  const visible = useVisible();

  const ready =
    eligible &&
    loaded &&
    visible &&
    !quiet &&
    taught === undefined &&
    !seen.includes(id);

  useEffect(() => {
    if (!ready || session.taught !== undefined) {
      return;
    }

    void claim(id, queryClient);
  }, [id, queryClient, ready]);

  const retire = useCallback(() => retireTaught(id), [id]);

  return { retire, show: taught === id && confirmed && !done && !quiet };
}

export function useNote(id: string, eligible: boolean) {
  const { retire, show } = useHint(id, eligible);

  useEffect(() => {
    if (!show) {
      return undefined;
    }

    const until = session.until ?? Date.now() + NOTE_MS;

    if (until <= Date.now()) {
      retire();

      return undefined;
    }

    const note = { id, retire };

    update({ note, until });

    const timer = setTimeout(retire, until - Date.now());

    return () => {
      clearTimeout(timer);

      if (session.note === note) {
        update({ note: undefined });
      }
    };
  }, [id, retire, show]);

  return retire;
}

export function useCurrentNote() {
  return useSession().note;
}
