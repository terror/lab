import type { SessionView } from '@lab/app-protocol';
import { useEffect, useState } from 'react';

export function useSessionStream(
  sessionId: string,
  enabled: boolean,
  refresh: () => Promise<SessionView>,
  scheduleRefresh: () => void
) {
  const [reconnecting, setReconnecting] = useState(false);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let stream: EventSource | undefined;

    let timer: ReturnType<typeof setTimeout> | undefined;

    let stopped = false;

    let delay = 1000;

    async function reconcile() {
      try {
        const session = await refresh();

        if (stopped) {
          return;
        }

        if (!session.running) {
          setReconnecting(false);

          return;
        }
      } catch {
        if (stopped) {
          return;
        }

        setReconnecting(true);
      }

      timer = setTimeout(connect, delay);

      delay = Math.min(delay * 2, 10_000);
    }

    function connect() {
      if (stopped) {
        return;
      }

      const source = new EventSource(
        `/api/chat?sessionId=${encodeURIComponent(sessionId)}`
      );

      stream = source;

      source.addEventListener('open', () => {
        if (!stopped) {
          setReconnecting(false);

          delay = 1000;

          scheduleRefresh();
        }
      });

      source.addEventListener('message', () => {
        if (!stopped) {
          scheduleRefresh();
        }
      });

      source.addEventListener('end', () => {
        source.close();

        if (!stopped) {
          void reconcile();
        }
      });

      source.addEventListener('error', () => {
        if (stopped) {
          return;
        }

        setReconnecting(true);

        if (source.readyState === EventSource.CLOSED) {
          void reconcile();
        } else {
          scheduleRefresh();
        }
      });
    }

    connect();

    return () => {
      stopped = true;

      stream?.close();

      clearTimeout(timer);
    };
  }, [enabled, refresh, scheduleRefresh, sessionId]);

  return enabled && reconnecting;
}
