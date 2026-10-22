import { ApiError, isAbortError, requestError } from '@/lib/errors';
import type { AppType } from '@lab/server';
import type { SessionMetadata, SessionSnapshot } from '@lab/shared';
import { queryOptions } from '@tanstack/react-query';
import * as hono from 'hono/client';

export const api = hono.hc<AppType>('/', {
  init: { credentials: 'same-origin' },
  fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = await fetch(input, init).catch((error) => {
      throw requestError(error);
    });

    return checkResponse(response);
  },
}).api;

export async function parseResponse<T extends hono.ClientResponse<unknown>>(
  request: T | Promise<T>
) {
  const response = await request;

  try {
    return await hono.parseResponse(response);
  } catch (error) {
    if (isAbortError(error) || error instanceof ApiError) {
      throw error;
    }

    if (error instanceof TypeError) {
      throw requestError(error);
    }

    throw new ApiError(
      502,
      'Unable to read the response from Lab. Please try again.',
      { cause: error }
    );
  }
}

async function checkResponse(response: Response) {
  if (response.ok) {
    return response;
  }

  const message = await response.text().catch((error) => {
    if (isAbortError(error)) {
      throw error;
    }

    return '';
  });

  throw new ApiError(response.status, message);
}

export const workspaceQueryOptions = queryOptions({
  queryKey: ['workspaces'],
  queryFn: ({ signal }) =>
    parseResponse(api.workspaces.$get(undefined, { init: { signal } })),
  staleTime: 60_000,
});

export function sessionListQueryOptions(workspaceId: string) {
  return queryOptions({
    queryKey: ['sessions', workspaceId],
    queryFn: ({ signal }) =>
      parseResponse(
        api.sessions.$get({ query: { workspaceId } }, { init: { signal } })
      ),
    staleTime: 10_000,
  });
}

export function sessionQueryOptions(sessionId: string) {
  return queryOptions({
    queryKey: ['session', sessionId],
    meta: { errorToast: false },
    queryFn: async ({ signal, client }) => {
      const next = await parseResponse(
        api.sessions[':sessionId'].$get(
          { param: { sessionId } },
          { init: { signal } }
        )
      );

      const current = client.getQueryData<SessionSnapshot>([
        'session',
        sessionId,
      ]);

      return mergeSessionSnapshot(current, next);
    },
    staleTime: 0,
  });
}

export function mergeSessionSnapshot(
  current: SessionSnapshot | undefined,
  next: SessionSnapshot
): SessionSnapshot {
  if (!current) {
    return next;
  }

  const snapshot = current.eventCount > next.eventCount ? current : next;

  const metadata = mergeSessionMetadata(current.metadata, next.metadata);

  return snapshot.metadata === metadata ? snapshot : { ...snapshot, metadata };
}

export function mergeSessionMetadata(
  current: SessionMetadata,
  next: SessionMetadata
): SessionMetadata {
  return Date.parse(current.updatedAt) > Date.parse(next.updatedAt)
    ? current
    : next;
}
