import { ErrorResponse, SessionCreated, SessionView } from '@lab/app-protocol';
import { type Static, type TSchema, Value } from '@lab/protocol';

export type SessionFailure =
  | { kind: 'http'; status: number }
  | { kind: 'network' }
  | { kind: 'timeout' }
  | { kind: 'protocol' };

export class SessionError extends Error {
  constructor(
    message: string,
    readonly failure: SessionFailure
  ) {
    super(message);
  }

  get retryable() {
    switch (this.failure.kind) {
      case 'network':

      case 'timeout':
        return true;

      case 'protocol':
        return false;

      case 'http':
        return (
          this.failure.status === 408 ||
          this.failure.status === 429 ||
          this.failure.status >= 500
        );
    }
  }
}

export function sessionError(error: unknown) {
  if (error instanceof SessionError) {
    return error;
  }

  if (error instanceof TypeError) {
    return new SessionError('Unable to connect to lab', { kind: 'network' });
  }

  return new SessionError(
    error instanceof Error
      ? error.message
      : 'Unable to complete the session request',
    { kind: 'protocol' }
  );
}

export async function request<T>(
  signal: AbortSignal,
  operation: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  const deadline = new AbortController();

  const timeout = setTimeout(() => deadline.abort(), 15_000);

  try {
    signal.throwIfAborted();

    return await operation(AbortSignal.any([signal, deadline.signal]));
  } catch (error) {
    signal.throwIfAborted();

    if (deadline.signal.aborted) {
      throw new SessionError('Lab did not respond in time', {
        kind: 'timeout',
      });
    }

    throw sessionError(error);
  } finally {
    clearTimeout(timeout);
  }
}

export async function checkResponse(response: Response) {
  if (response.ok) {
    return response;
  }

  const body: unknown = await response.json().catch(() => undefined);

  throw new SessionError(
    Value.Check(ErrorResponse, body)
      ? body.error
      : `Lab returned HTTP ${response.status}`,
    { kind: 'http', status: response.status }
  );
}

async function json<T extends TSchema>(
  schema: T,
  path: string,
  signal: AbortSignal,
  options?: RequestInit
): Promise<Static<T>> {
  return request(signal, async (active) => {
    const response = await checkResponse(
      await fetch(path, { ...options, signal: active, cache: 'no-store' })
    );

    const body: unknown = await response.json();

    if (!Value.Check(schema, body)) {
      throw new SessionError('Lab returned an invalid session response', {
        kind: 'protocol',
      });
    }

    return body;
  });
}

export function createSession(signal: AbortSignal) {
  return json(SessionCreated, '/api/sessions', signal, {
    method: 'POST',
  });
}

export async function readSession(sessionId: string, signal: AbortSignal) {
  const view = await json(
    SessionView,
    `/api/sessions/${encodeURIComponent(sessionId)}`,
    signal
  );

  if (view.sessionId !== sessionId) {
    throw new SessionError('Lab returned a different session', {
      kind: 'protocol',
    });
  }

  return view;
}

export async function cancelSession(sessionId: string, signal: AbortSignal) {
  await request(signal, async (active) => {
    const response = await checkResponse(
      await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/cancel`, {
        method: 'POST',
        signal: active,
      })
    );

    if (response.status !== 204) {
      await response.body?.cancel().catch(() => undefined);

      throw new SessionError('Lab did not confirm cancellation', {
        kind: 'protocol',
      });
    }
  });
}
