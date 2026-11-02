import type { SessionView } from '@lab/app-protocol';

import type { SessionRetry } from './session-state';
import {
  SessionError,
  cancelSession,
  checkResponse,
  readSession,
  request,
  sessionError,
} from './sessions';
import { chatBody, readChat } from './sse';

export type SessionProgress =
  | { type: 'VIEW'; view: SessionView }
  | { type: 'ACCEPTED' }
  | { type: 'STOP_FAILED'; error: SessionError };

export interface SessionOperation {
  sessionId: string;
  retry: SessionRetry;
  revision: number;
  progress: (event: SessionProgress) => void;
}

async function chat(operation: SessionOperation, signal: AbortSignal) {
  return request(signal, async (active) => {
    const options: RequestInit =
      operation.retry.kind === 'submit'
        ? {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(operation.retry.submission),
            signal: active,
          }
        : { signal: active, cache: 'no-store' };

    const path =
      operation.retry.kind === 'submit'
        ? '/api/chat'
        : `/api/chat?sessionId=${encodeURIComponent(operation.sessionId)}`;

    const response = await checkResponse(await fetch(path, options));

    await chatBody(response, operation.retry.kind !== 'submit');

    return response;
  });
}

async function observe(
  response: Response,
  operation: SessionOperation,
  signal: AbortSignal
) {
  const connection = new AbortController();

  const active = AbortSignal.any([signal, connection.signal]);

  let pending: Promise<SessionView> | undefined;

  let requested = 0;

  let completed = 0;

  let timer: ReturnType<typeof setTimeout> | undefined;

  async function snapshot() {
    const revision = requested;

    const view = await readSession(operation.sessionId, active);

    active.throwIfAborted();

    completed = revision;

    operation.progress({ type: 'VIEW', view });

    return view;
  }

  async function drain() {
    let view = await snapshot();

    while (completed < requested) {
      view = await snapshot();
    }

    return view;
  }

  async function refresh() {
    const revision = ++requested;

    for (;;) {
      pending ??= drain().finally(() => {
        pending = undefined;
      });

      const view = await pending;

      if (completed >= revision) {
        return view;
      }
    }
  }

  function schedule() {
    if (active.aborted || timer !== undefined) {
      return;
    }

    timer = setTimeout(() => {
      timer = undefined;

      void refresh().catch((error: unknown) => connection.abort(error));
    }, 250);
  }

  try {
    schedule();

    await readChat(response, active, schedule);

    clearTimeout(timer);

    return await refresh();
  } catch (error) {
    if (active.aborted) {
      throw active.reason;
    }

    throw sessionError(error);
  } finally {
    clearTimeout(timer);

    connection.abort();

    await pending?.catch(() => undefined);
  }
}

export async function performSession(
  operation: SessionOperation,
  signal: AbortSignal
) {
  let revision = operation.revision;

  const progress = (event: SessionProgress) => {
    signal.throwIfAborted();

    if (event.type === 'VIEW') {
      if (event.view.revision < revision) {
        throw new SessionError('Lab returned an older session snapshot', {
          kind: 'protocol',
        });
      }

      revision = event.view.revision;
    }

    operation.progress(event);
  };

  switch (operation.retry.kind) {
    case 'submit': {
      const response = await chat(operation, signal);

      progress({ type: 'ACCEPTED' });

      return observe(response, { ...operation, progress }, signal);
    }

    case 'stop':
      try {
        await cancelSession(operation.sessionId, signal);

        progress({ type: 'ACCEPTED' });
      } catch (error) {
        signal.throwIfAborted();

        progress({ type: 'STOP_FAILED', error: sessionError(error) });
      }

      break;

    case 'observe':
      break;
  }

  const view = await readSession(operation.sessionId, signal);

  progress({ type: 'VIEW', view });

  if (view.status !== 'running') {
    return view;
  }

  const response = await chat(
    { ...operation, retry: { kind: 'observe' } },
    signal
  );

  return observe(response, { ...operation, progress }, signal);
}
