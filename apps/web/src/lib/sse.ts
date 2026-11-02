import { ChatEvent } from '@lab/app-protocol';
import { Value } from '@lab/protocol';
import { createParser } from 'eventsource-parser';

import { SessionError } from './sessions';

function chatEvent(data: string): ChatEvent {
  try {
    const value: unknown = JSON.parse(data);

    if (!Value.Check(ChatEvent, value)) {
      throw new SessionError('Lab returned an invalid chat event', {
        kind: 'protocol',
      });
    }

    return value;
  } catch (error) {
    if (error instanceof SessionError) {
      throw error;
    }

    throw new SessionError('Lab returned invalid chat data', {
      kind: 'protocol',
    });
  }
}

export async function chatBody(response: Response, allowEmpty: boolean) {
  if (allowEmpty && response.status === 204) {
    return null;
  }

  if (
    response.status !== 200 ||
    !response.body ||
    response.headers
      .get('Content-Type')
      ?.split(';')[0]
      ?.trim()
      .toLowerCase() !== 'text/event-stream'
  ) {
    await response.body?.cancel().catch(() => undefined);

    throw new SessionError('Lab did not return a chat stream', {
      kind: 'protocol',
    });
  }

  return response.body;
}

export async function readChat(
  response: Response,
  signal: AbortSignal,
  onEvent: (event: ChatEvent) => void
) {
  const body = await chatBody(response, true);

  if (signal.aborted) {
    await body?.cancel().catch(() => undefined);

    signal.throwIfAborted();
  }

  if (!body) {
    return;
  }

  const reader = body.getReader();

  const abort = () => {
    void reader.cancel(signal.reason).catch(() => undefined);
  };

  signal.addEventListener('abort', abort, { once: true });

  const decoder = new TextDecoder('utf-8', { fatal: true });

  let ended = false;

  const parser = createParser({
    maxBufferSize: 4 * 1024 * 1024,
    onError: (error) => {
      if (error.type === 'max-buffer-size-exceeded') {
        throw new SessionError('Lab returned an oversized chat event', {
          kind: 'protocol',
        });
      }
    },
    onEvent: (event) => {
      if (ended) {
        return;
      }

      if (event.event === 'end') {
        ended = true;

        return;
      }

      if (event.event !== undefined && event.event !== 'message') {
        throw new SessionError('Lab returned an unknown chat event', {
          kind: 'protocol',
        });
      }

      signal.throwIfAborted();

      onEvent(chatEvent(event.data));
    },
  });

  try {
    for (;;) {
      let timeout: ReturnType<typeof setTimeout> | undefined;

      const deadline = new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () =>
            reject(
              new SessionError('The chat connection stopped responding', {
                kind: 'timeout',
              })
            ),
          45_000
        );
      });

      const chunk = await Promise.race([reader.read(), deadline]).finally(() =>
        clearTimeout(timeout)
      );

      signal.throwIfAborted();

      try {
        parser.feed(decoder.decode(chunk.value, { stream: !chunk.done }));
      } catch (error) {
        if (error instanceof TypeError) {
          throw new SessionError('Lab returned invalid UTF-8 chat data', {
            kind: 'protocol',
          });
        }

        throw error;
      }

      if (ended) {
        return;
      }

      if (chunk.done) {
        throw new SessionError(
          'The connection closed before the response finished',
          { kind: 'network' }
        );
      }
    }
  } finally {
    signal.removeEventListener('abort', abort);

    await reader.cancel().catch(() => undefined);

    reader.releaseLock();
  }
}
