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

export const notes: Record<string, string> = {
  plan: 'I’ll tick these off as I go.',
  project: 'Instructions here apply to every chat.',
  versions: 'Earlier versions stay, next to your message.',
};

type Note = { id: string; retire: () => void };

type Session = {
  confirmed: boolean;
  done: boolean;
  note?: Note;
  taught?: string;
  left?: number;
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

    if (fresh) {
      update({ confirmed: true });
    } else if (preferences.hints.includes(id)) {
      update({ taught: undefined });
    } else {
      update({ done: true });
    }
  } catch {
    update({ done: true });
  }
}

async function remember(id: string, queryClient: QueryClient) {
  const response = await call(
    client.preferences.hints.$post({ json: { id } })
  ).catch(() => undefined);

  if (response) {
    queryClient.setQueryData(
      preferencesQueryOptions.queryKey,
      response.preferences
    );
  }
}

export function useSeen(id: string, when: boolean) {
  const queryClient = useQueryClient();
  const { loaded, seen } = useLedger();

  const fresh = when && loaded && !seen.includes(id);

  useEffect(() => {
    if (fresh) {
      void remember(id, queryClient);
    }
  }, [fresh, id, queryClient]);
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

  return {
    pending: ready || (eligible && taught === id && !confirmed && !done),
    retire,
    show: eligible && taught === id && confirmed && !done && !quiet,
  };
}

export function useNote(id: string, eligible: boolean) {
  const { retire, show } = useHint(id, eligible);
  const visible = useVisible();

  const shown = show && visible;

  useEffect(() => {
    if (!shown) {
      return undefined;
    }

    const left = session.left ?? NOTE_MS;

    if (left <= 0) {
      retire();

      return undefined;
    }

    const until = Date.now() + left;

    const note = { id, retire };

    update({ note });

    const timer = setTimeout(retire, left);

    return () => {
      clearTimeout(timer);

      update({
        left: until - Date.now(),
        note: session.note === note ? undefined : session.note,
      });
    };
  }, [id, retire, shown]);

  return retire;
}

export function useCurrentNote() {
  return useSession().note;
}
