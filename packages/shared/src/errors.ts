import { z } from 'zod';

export type ApiFailure = { error: string };

export type ErrorRecovery = 'retry' | 'sign-in' | 'none';

const messages: Record<number, string> = {
  0: 'Unable to reach Lab. Check your connection and try again.',
  400: 'The request could not be processed. Check your input and try again.',
  401: 'Your session has expired. Sign in again to continue.',
  403: 'You don’t have permission to do that.',
  404: 'This content is unavailable or you no longer have access.',
  408: 'The request timed out. Please try again.',
  409: 'This change conflicts with another update. Refresh and try again.',
  413: 'The request is too large. Try sending less content.',
  429: 'Too many requests. Wait a moment and try again.',
};

export function httpError(status: number) {
  const recovery = errorRecovery(status);

  return {
    message: messages[status] ?? 'Something went wrong. Please try again.',
    recovery,
    rejected: status >= 400 && status < 500 && recovery !== 'retry',
  };
}

function errorRecovery(status: number): ErrorRecovery {
  switch (status) {
    case 401:
      return 'sign-in';
    case 0:
    case 408:
    case 429:
      return 'retry';
    default:
      return status >= 500 ? 'retry' : 'none';
  }
}

const message = z.string().trim().min(1);

const providerErrorSchema = z.union([
  z
    .object({ error: z.object({ message }) })
    .transform((value) => value.error.message),
  z.object({ error: message }).transform((value) => value.error),
  z.object({ message }).transform((value) => value.message),
]);

export function readableErrorMessage(
  message: string,
  fallback = 'Something went wrong. Please try again.'
) {
  let text = message.trim();

  for (let depth = 0; depth < 3; depth++) {
    if (!text || text.startsWith('<')) {
      return fallback;
    }

    const start = text.indexOf('{');

    if (start === -1) {
      return text.length <= 1_000 && !text.startsWith('[') ? text : fallback;
    }

    try {
      const result = providerErrorSchema.safeParse(
        JSON.parse(text.slice(start))
      );

      if (!result.success) {
        return fallback;
      }

      text = result.data;
    } catch {
      if (
        start === 0 ||
        /^\d{3}\s/.test(text) ||
        /^\{\s*"/.test(text.slice(start))
      ) {
        return fallback;
      }

      return text.length <= 1_000 ? text : fallback;
    }
  }

  return fallback;
}
