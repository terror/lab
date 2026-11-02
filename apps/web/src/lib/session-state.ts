import type { ChatSubmission, SessionView } from '@lab/app-protocol';

export type SessionRetry =
  | { kind: 'submit'; submission: ChatSubmission }
  | { kind: 'observe' }
  | { kind: 'stop' };

export type SessionActivity =
  | { status: 'idle' }
  | { status: 'submitting'; submission: ChatSubmission }
  | { status: 'running' }
  | { status: 'stopping' }
  | {
      status: 'reconnecting';
      error: Error;
      attempt: number;
      retry: SessionRetry;
      submission?: ChatSubmission;
    }
  | {
      status: 'failed';
      error: Error;
      retry: SessionRetry;
      retryable: boolean;
      submission?: ChatSubmission;
    };

export type SessionState =
  | { status: 'loading' }
  | { status: 'unavailable'; error: Error; retryable: boolean }
  | { status: 'ready'; view: SessionView; activity: SessionActivity };
