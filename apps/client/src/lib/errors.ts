import {
  type ErrorRecovery,
  httpError,
  readableErrorMessage,
} from '@lab/shared';
import { type ExternalToast, toast } from 'sonner';

export class ApiError extends Error {
  readonly recovery: ErrorRecovery;
  readonly rejected: boolean;

  constructor(
    readonly status: number,
    message = '',
    options?: ErrorOptions
  ) {
    const policy = httpError(status);

    super(readableErrorMessage(message, policy.message), options);

    this.name = 'ApiError';
    this.recovery = policy.recovery;
    this.rejected = policy.rejected;
  }
}

export function isAbortError(error: unknown): error is Error {
  return error instanceof Error && error.name === 'AbortError';
}

export function requestError(error: unknown): Error {
  if (error instanceof ApiError || isAbortError(error)) {
    return error;
  }

  return new ApiError(0, '', { cause: error });
}

export function canRetry(error: Error) {
  return error instanceof ApiError && error.recovery === 'retry';
}

export function errorPresentation(
  error: Error,
  onRetry?: () => void,
  retryLabel = 'Try again'
) {
  const message =
    error instanceof ApiError || error.name === 'Error'
      ? readableErrorMessage(error.message)
      : httpError(500).message;

  const recovery = error instanceof ApiError ? error.recovery : 'retry';

  const id =
    error instanceof ApiError
      ? `api:${error.status}:${message}`
      : `${error.name}:${message}`;

  const presentation = { id, message };

  switch (recovery) {
    case 'sign-in':
      return {
        ...presentation,
        action: { label: 'Sign in again', onClick: () => location.assign('/') },
      };
    case 'retry':
      return {
        ...presentation,
        action: onRetry ? { label: retryLabel, onClick: onRetry } : undefined,
      };
    case 'none':
      return { ...presentation, action: undefined };
  }
}

export function notifyError(
  caught: unknown,
  {
    onRetry,
    retryLabel,
    ...options
  }: Omit<ExternalToast, 'action'> & {
    onRetry?: () => void;
    retryLabel?: string;
  } = {}
) {
  const error =
    caught instanceof Error
      ? caught
      : new Error(httpError(500).message, { cause: caught });

  if (isAbortError(error)) {
    return;
  }

  const { id, message, action } = errorPresentation(error, onRetry, retryLabel);

  return toast.error(message, {
    id,
    ...options,
    action,
  });
}
