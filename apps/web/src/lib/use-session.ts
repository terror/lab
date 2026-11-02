import type { ChatSubmission } from '@lab/app-protocol';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';

import {
  cancelSession,
  readChat,
  sessionQueryOptions,
  submitChat,
} from './sessions';

export function useSession(sessionId: string) {
  const client = useQueryClient();

  const session = useQuery(sessionQueryOptions(sessionId));

  const controller = useRef<AbortController | undefined>(undefined);

  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const refresh = useCallback(
    () => client.fetchQuery(sessionQueryOptions(sessionId)),
    [client, sessionId]
  );

  const scheduleRefresh = useCallback(() => {
    if (timer.current !== undefined) {
      return;
    }

    timer.current = setTimeout(() => {
      timer.current = undefined;

      void refresh().catch(() => undefined);
    }, 250);
  }, [refresh]);

  useEffect(
    () => () => {
      controller.current?.abort();

      clearTimeout(timer.current);
    },
    []
  );

  const sending = useMutation({
    mutationFn: async (submission: ChatSubmission) => {
      const connection = new AbortController();

      controller.current = connection;

      try {
        const response = await submitChat(submission, connection.signal);

        scheduleRefresh();

        await readChat(response, scheduleRefresh);
      } finally {
        clearTimeout(timer.current);

        timer.current = undefined;

        controller.current = undefined;

        if (!connection.signal.aborted) {
          await refresh();
        }
      }
    },
  });

  const stopping = useMutation({
    mutationFn: async () => {
      await cancelSession(sessionId);

      await refresh();
    },
  });

  return {
    session,
    sending,
    stopping,
    send: (text: string) =>
      sending.mutate({ sessionId, text, requestId: crypto.randomUUID() }),
  };
}
