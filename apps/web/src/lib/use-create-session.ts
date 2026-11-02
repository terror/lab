import { useCallback, useEffect, useRef, useState } from 'react';

import { createSession, sessionError } from './sessions';
import { subscribeSessionNavigation } from './use-session-location';

type CreationState =
  | { status: 'idle' }
  | { status: 'creating' }
  | { status: 'failed'; error: Error };

export function useCreateSession(openSession: (sessionId: string) => void) {
  const [state, setState] = useState<CreationState>({ status: 'idle' });

  const pending = useRef<AbortController | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = subscribeSessionNavigation(() => {
      pending.current?.abort();

      pending.current = undefined;

      setState({ status: 'idle' });
    });

    return () => {
      unsubscribe();

      pending.current?.abort();

      pending.current = undefined;
    };
  }, []);

  const create = useCallback(async () => {
    if (pending.current) {
      return;
    }

    const connection = new AbortController();

    pending.current = connection;

    setState({ status: 'creating' });

    try {
      const created = await createSession(connection.signal);

      if (connection.signal.aborted || pending.current !== connection) {
        return;
      }

      openSession(created.sessionId);

      pending.current = undefined;

      setState({ status: 'idle' });
    } catch (error) {
      if (connection.signal.aborted || pending.current !== connection) {
        return;
      }

      pending.current = undefined;

      setState({ status: 'failed', error: sessionError(error) });
    }
  }, [openSession]);

  return { state, create };
}
