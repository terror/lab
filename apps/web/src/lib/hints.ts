import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useSyncExternalStore } from 'react';

import { preferencesQueryOptions, usePreference } from './preferences';
import { useQuiet } from './voice';

const NOTE_MS = 12_000;

type Note = { id: string; retire: () => void };

type Session = { done: boolean; note?: Note; taught?: string; until?: number };

let session: Session = { done: false };

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
  const queryClient = useQueryClient();
  const { isPlaceholderData, isSuccess } = useQuery(preferencesQueryOptions);
  const [seen, setSeen] = usePreference('hints');

  const mark = useCallback(
    (id: string) => {
      const current = queryClient.getQueryData(
        preferencesQueryOptions.queryKey
      )?.hints;

      if (current && !current.includes(id)) {
        setSeen([...current, id]);
      }
    },
    [queryClient, setSeen]
  );

  return { loaded: isSuccess && !isPlaceholderData, mark, seen };
}

function retireTaught(id: string) {
  if (session.taught === id) {
    update({ done: true });
  }
}

export function useHint(id: string, eligible: boolean) {
  const quiet = useQuiet();
  const { loaded, mark, seen } = useLedger();
  const { done, taught } = useSession();
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

    update({ taught: id });
    mark(id);
  }, [id, mark, ready]);

  const retire = useCallback(() => retireTaught(id), [id]);

  return { retire, show: taught === id && !done && !quiet };
}

export function useNote(id: string, eligible: boolean) {
  const { retire, show } = useHint(id, eligible);

  useEffect(() => {
    if (!show) {
      return undefined;
    }

    const note = { id, retire };
    const until = session.until ?? Date.now() + NOTE_MS;

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
