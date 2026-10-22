import {
  api,
  mergeSessionSnapshot,
  parseResponse,
  sessionQueryOptions,
} from '@/lib/api';
import { ApiError, canRetry, requestError } from '@/lib/errors';
import type { ChatSubmission, SessionSnapshot } from '@lab/shared';
import { type QueryClient, mutationOptions } from '@tanstack/react-query';
import { EventSourceParserStream } from 'eventsource-parser/stream';

export type ChatActivity = 'idle' | 'submitting' | 'running' | 'stopping';

export type ChatConnection =
  | { status: 'idle' }
  | { status: 'connecting' }
  | { status: 'connected' }
  | { status: 'reconnecting'; attempt: number }
  | { status: 'disconnected'; error: Error };

export type PendingSubmission = Pick<ChatSubmission, 'requestId' | 'text'> & {
  state: 'uncertain' | 'rejected';
};

export const chatSubmissionKey = ['chat-submission'];

export function chatSubmissionOptions(
  client: QueryClient,
  signal: AbortSignal
) {
  return mutationOptions({
    mutationKey: chatSubmissionKey,
    mutationFn: async ({ sessionId, requestId, text }: ChatSubmission) => {
      signal.throwIfAborted();

      const accepted = await parseResponse(
        api.sessions[':sessionId'].submissions.$post(
          { param: { sessionId }, json: { requestId, text } },
          { init: { signal } }
        )
      );

      signal.throwIfAborted();
      return accepted;
    },
    onSuccess: ({ snapshot }, { sessionId }) => {
      if (signal.aborted) {
        return;
      }

      client.setQueryData(sessionQueryOptions(sessionId).queryKey, (current) =>
        mergeSessionSnapshot(current, snapshot)
      );
      void client.invalidateQueries({ queryKey: ['sessions'] });
    },
  });
}

export async function stopChat(sessionId: string, signal: AbortSignal) {
  signal.throwIfAborted();

  await api.sessions[':sessionId'].cancel.$post(
    { param: { sessionId } },
    { init: { signal } }
  );

  signal.throwIfAborted();
}

async function* sessionSnapshots(sessionId: string, signal: AbortSignal) {
  const response = await api.sessions[':sessionId'].events.$get(
    { param: { sessionId } },
    {
      init: { signal, cache: 'no-store' },
      headers: { Accept: 'text/event-stream' },
    }
  );

  if (
    !response.body ||
    !response.headers.get('content-type')?.includes('text/event-stream')
  ) {
    throw new Error('Unable to connect to the conversation.');
  }

  const reader = response.body
    .pipeThrough(new TextDecoderStream('utf-8', { fatal: true }))
    .pipeThrough(new EventSourceParserStream())
    .getReader();

  try {
    while (!signal.aborted) {
      const { value, done } = await reader.read().catch((error) => {
        throw requestError(error);
      });

      signal.throwIfAborted();

      if (done) {
        throw new ApiError(0);
      }

      switch (value.event) {
        case 'snapshot':
          try {
            yield JSON.parse(value.data) as SessionSnapshot;
          } catch (cause) {
            throw new Error(
              'Unable to read live updates. Reconnect to try again.',
              {
                cause,
              }
            );
          }
          break;
        case 'access-revoked':
          throw new ApiError(
            JSON.parse(value.data)?.status === 401 ? 401 : 403
          );
        case 'end':
          return;
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

export async function followSession({
  sessionId,
  signal,
  onSnapshot,
  onConnection,
  onAccessRevoked,
}: {
  sessionId: string;
  signal: AbortSignal;
  onSnapshot: (snapshot: SessionSnapshot) => SessionSnapshot;
  onConnection: (connection: ChatConnection) => void;
  onAccessRevoked: (error: ApiError) => void;
}) {
  for (let attempt = 0; !signal.aborted; attempt++) {
    onConnection(
      attempt === 0
        ? { status: 'connecting' }
        : { status: 'reconnecting', attempt }
    );

    try {
      let connected = false;

      for await (const next of sessionSnapshots(sessionId, signal)) {
        signal.throwIfAborted();

        if (!connected) {
          connected = true;
          attempt = 0;
          onConnection({ status: 'connected' });
        }

        const snapshot = onSnapshot(next);

        if (!snapshot.unfinished) {
          onConnection({ status: 'idle' });
          return;
        }
      }

      throw new ApiError(0);
    } catch (caught) {
      if (signal.aborted) {
        return;
      }

      const error =
        caught instanceof Error
          ? caught
          : new Error('Unable to update the conversation.');

      if (
        error instanceof ApiError &&
        (error.status === 401 || error.status === 403 || error.status === 404)
      ) {
        onAccessRevoked(error);
      }

      if (!canRetry(error)) {
        onConnection({ status: 'disconnected', error });
        return;
      }

      onConnection({ status: 'reconnecting', attempt: attempt + 1 });

      await reconnectDelay(Math.min(1_000 * 2 ** attempt, 15_000), signal);
    }
  }
}

function reconnectDelay(milliseconds: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', finish);
      resolve();
    };

    const timer = setTimeout(finish, milliseconds);

    signal.addEventListener('abort', finish, { once: true });

    if (signal.aborted) {
      finish();
    }
  });
}
