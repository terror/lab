import {
  ChatEvent,
  type ChatSubmission,
  ErrorResponse,
  SessionCreated,
  SessionView,
} from '@lab/app-protocol';
import { Value } from '@lab/protocol';
import { queryOptions } from '@tanstack/react-query';

export class SessionError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

async function request(path: string, options?: RequestInit) {
  const response = await fetch(path, options);

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => undefined);

    throw new SessionError(
      Value.Check(ErrorResponse, body)
        ? body.error
        : 'Unable to complete the session request',
      response.status
    );
  }

  return response;
}

export async function createSession() {
  const response = await request('/api/sessions', { method: 'POST' });

  return Value.Parse(SessionCreated, await response.json());
}

export const sessionQueryOptions = (sessionId: string) =>
  queryOptions({
    queryKey: ['session', sessionId],
    queryFn: async ({ signal }) => {
      const response = await request(
        `/api/sessions/${encodeURIComponent(sessionId)}`,
        { signal, cache: 'no-store' }
      );

      return Value.Parse(SessionView, await response.json());
    },
    retry: (count, error) =>
      count < 2 && (!(error instanceof SessionError) || error.status >= 500),
  });

export async function cancelSession(sessionId: string) {
  await request(`/api/sessions/${encodeURIComponent(sessionId)}/cancel`, {
    method: 'POST',
  });
}

export function submitChat(submission: ChatSubmission, signal: AbortSignal) {
  return request('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(submission),
    signal,
  });
}

export async function readChat(
  response: Response,
  onEvent: (event: ChatEvent) => void
) {
  if (response.status === 204) {
    return;
  }

  if (
    !response.body ||
    !response.headers.get('Content-Type')?.startsWith('text/event-stream')
  ) {
    throw new Error('Lab did not return a chat stream');
  }

  const reader = response.body.getReader();

  const decoder = new TextDecoder('utf-8', { fatal: true });

  let buffer = '';

  let data: string[] = [];

  let event = '';

  try {
    for (;;) {
      const chunk = await reader.read();

      const { done } = chunk;

      buffer += decoder.decode(chunk.value, { stream: !done });

      for (;;) {
        const newline = /\r\n|\r|\n/.exec(buffer);

        if (
          !newline ||
          (!done && newline[0] === '\r' && newline.index === buffer.length - 1)
        ) {
          break;
        }

        const line = buffer.slice(0, newline.index);

        buffer = buffer.slice(newline.index + newline[0].length);

        if (line === '') {
          if (event === 'end') {
            return;
          }

          if (data.length > 0 && (event === '' || event === 'message')) {
            const value: unknown = JSON.parse(data.join('\n'));

            if (!Value.Check(ChatEvent, value)) {
              throw new Error('Lab returned an invalid chat event');
            }

            onEvent(value);
          }

          data = [];

          event = '';
        } else if (!line.startsWith(':')) {
          const colon = line.indexOf(':');

          const field = colon < 0 ? line : line.slice(0, colon);

          const value =
            colon < 0 ? '' : line.slice(colon + 1).replace(/^ /, '');

          if (field === 'data') {
            data.push(value);
          } else if (field === 'event') {
            event = value;
          }
        }
      }

      if (done) {
        throw new Error('The connection closed before the response finished');
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined);

    reader.releaseLock();
  }
}
