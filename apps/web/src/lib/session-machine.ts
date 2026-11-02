import type { ChatSubmission, SessionView } from '@lab/app-protocol';
import { assign, fromPromise, setup } from 'xstate';

import type {
  SessionActivity,
  SessionRetry,
  SessionState,
} from './session-state';
import {
  type SessionOperation,
  type SessionProgress,
  performSession,
} from './session-transport';
import { readSession, sessionError } from './sessions';

interface SessionContext {
  sessionId: string;
  state: SessionState;
  retry: SessionRetry;
  attempt: number;
  operation: number;
  submission: ChatSubmission | null;
}

export type SessionEvent =
  | { type: 'SEND'; submission: ChatSubmission }
  | { type: 'STOP' }
  | { type: 'RETRY' }
  | (SessionProgress & { operation: number });

function activity(retry: SessionRetry): SessionActivity {
  switch (retry.kind) {
    case 'submit':
      return { status: 'submitting', submission: retry.submission };

    case 'observe':
      return { status: 'running' };

    case 'stop':
      return { status: 'stopping' };
  }
}

function begin(state: SessionState, retry: SessionRetry): SessionState {
  if (state.status !== 'ready') {
    return state;
  }

  return { ...state, activity: activity(retry) };
}

function updateView(state: SessionState, view: SessionView): SessionState {
  if (state.status !== 'ready' || view.revision < state.view.revision) {
    return state;
  }

  return { ...state, view };
}

function failedStop(state: SessionState) {
  return (
    state.status === 'ready' &&
    state.activity.status === 'failed' &&
    state.activity.retry.kind === 'stop'
  );
}

function resume(state: SessionState, retry: SessionRetry): SessionState {
  if (failedStop(state)) {
    return state;
  }

  return begin(state, retry);
}

function retryIntent(state: SessionState): SessionRetry | undefined {
  if (state.status !== 'ready') {
    return undefined;
  }

  switch (state.activity.status) {
    case 'failed':
      return state.activity.retryable ? state.activity.retry : undefined;

    case 'reconnecting':
      return state.activity.retry;

    default:
      return undefined;
  }
}

function canStop(state: SessionState) {
  return (
    state.status === 'ready' &&
    state.view.status === 'running' &&
    state.activity.status !== 'stopping'
  );
}

export const sessionMachine = setup({
  types: {
    context: {} as SessionContext,
    input: {} as { sessionId: string },
    events: {} as SessionEvent,
  },
  actors: {
    load: fromPromise<SessionView, { sessionId: string }>(({ input, signal }) =>
      readSession(input.sessionId, signal)
    ),
    operate: fromPromise<SessionView, SessionOperation>(({ input, signal }) =>
      performSession(input, signal)
    ),
  },
  delays: {
    reconnect: ({ context }) =>
      Math.min(1000 * 2 ** (context.attempt - 1), 10_000),
  },
  guards: {
    canStop: ({ context }) => canStop(context.state),
    canRetry: ({ context }) => retryIntent(context.state) !== undefined,
    recoverable: ({ context }, params: { error: unknown }) =>
      context.retry.kind !== 'submit' &&
      context.attempt < 3 &&
      sessionError(params.error).retryable,
  },
  actions: {
    stop: assign(({ context }) => {
      const retry: SessionRetry = { kind: 'stop' };

      return { retry, attempt: 0, state: begin(context.state, retry) };
    }),
    retry: assign(({ context }) => {
      const retry = retryIntent(context.state);

      if (!retry) {
        return {};
      }

      return { retry, attempt: 0, state: begin(context.state, retry) };
    }),
    reconnect: assign(({ context }, params: { error: unknown }) => {
      if (context.state.status !== 'ready') {
        return {};
      }

      const attempt = context.attempt + 1;

      if (failedStop(context.state)) {
        return { attempt };
      }

      return {
        attempt,
        state: {
          ...context.state,
          activity: {
            status: 'reconnecting',
            error: sessionError(params.error),
            attempt,
            retry: context.retry,
            ...(context.submission ? { submission: context.submission } : {}),
          },
        } satisfies SessionState,
      };
    }),
    fail: assign(({ context }, params: { error: unknown }) => {
      if (context.state.status !== 'ready' || failedStop(context.state)) {
        return {};
      }

      const error = sessionError(params.error);

      return {
        state: {
          ...context.state,
          activity: {
            status: 'failed',
            error,
            retry: context.retry,
            retryable: error.retryable,
            ...(context.submission ? { submission: context.submission } : {}),
          },
        } satisfies SessionState,
      };
    }),
  },
}).createMachine({
  id: 'session',
  context: ({ input }) => ({
    sessionId: input.sessionId,
    state: { status: 'loading' },
    retry: { kind: 'observe' },
    attempt: 0,
    operation: 0,
    submission: null,
  }),
  initial: 'loading',
  states: {
    loading: {
      entry: assign({ state: { status: 'loading' } }),
      invoke: {
        src: 'load',
        input: ({ context }) => ({ sessionId: context.sessionId }),
        onDone: [
          {
            guard: ({ event }) => event.output.status === 'running',
            target: 'working',
            actions: assign({
              state: ({ event }) => ({
                status: 'ready',
                view: event.output,
                activity: { status: 'running' },
              }),
            }),
          },
          {
            target: 'idle',
            actions: assign({
              state: ({ event }) => ({
                status: 'ready',
                view: event.output,
                activity: { status: 'idle' },
              }),
            }),
          },
        ],
        onError: {
          target: 'unavailable',
          actions: assign({
            state: ({ event }) => {
              const error = sessionError(event.error);

              return {
                status: 'unavailable',
                error,
                retryable: error.retryable,
              };
            },
          }),
        },
      },
    },
    unavailable: {
      on: {
        RETRY: {
          target: 'loading',
          guard: ({ context }) =>
            context.state.status === 'unavailable' && context.state.retryable,
        },
      },
    },
    idle: {
      on: {
        SEND: {
          guard: ({ context, event }) =>
            context.state.status === 'ready' &&
            context.state.view.status !== 'running' &&
            event.submission.sessionId === context.sessionId &&
            event.submission.text.trim().length > 0,
          target: 'working',
          actions: assign(({ context, event }) => {
            const retry: SessionRetry = {
              kind: 'submit',
              submission: event.submission,
            };

            return {
              retry,
              attempt: 0,
              submission: event.submission,
              state: begin(context.state, retry),
            };
          }),
        },
      },
    },
    working: {
      entry: assign({ operation: ({ context }) => context.operation + 1 }),
      invoke: {
        src: 'operate',
        input: ({ context, self }) => ({
          sessionId: context.sessionId,
          retry: context.retry,
          revision:
            context.state.status === 'ready' ? context.state.view.revision : 0,
          progress: (event) =>
            self.send({ ...event, operation: context.operation }),
        }),
        onDone: [
          {
            guard: ({ event }) => event.output.status === 'running',
            target: 'working',
            reenter: true,
            actions: assign(({ context, event }) => ({
              retry: { kind: 'observe' } as const,
              state: {
                status: 'ready',
                view: event.output,
                activity:
                  context.state.status === 'ready' &&
                  (context.state.activity.status === 'stopping' ||
                    failedStop(context.state))
                    ? context.state.activity
                    : { status: 'running' },
              } satisfies SessionState,
            })),
          },
          {
            target: 'idle',
            actions: assign({
              attempt: 0,
              submission: null,
              state: ({ event }) => ({
                status: 'ready',
                view: event.output,
                activity: { status: 'idle' },
              }),
            }),
          },
        ],
        onError: [
          {
            guard: {
              type: 'recoverable',
              params: ({ event }) => ({ error: event.error }),
            },
            target: 'reconnecting',
            actions: {
              type: 'reconnect',
              params: ({ event }) => ({ error: event.error }),
            },
          },
          {
            target: 'failed',
            actions: {
              type: 'fail',
              params: ({ event }) => ({ error: event.error }),
            },
          },
        ],
      },
      on: {
        VIEW: {
          guard: ({ context, event }) =>
            event.operation === context.operation &&
            event.view.sessionId === context.sessionId,
          actions: assign(({ context, event }) => ({
            state: updateView(context.state, event.view),
            attempt:
              context.state.status === 'ready' &&
              event.view.revision > context.state.view.revision
                ? 0
                : context.attempt,
          })),
        },
        ACCEPTED: {
          guard: ({ context, event }) => event.operation === context.operation,
          actions: assign(({ context }) => ({
            retry: { kind: 'observe' } as const,
            attempt: 0,
            state:
              context.state.status === 'ready' &&
              context.state.activity.status === 'stopping'
                ? context.state
                : begin(context.state, { kind: 'observe' }),
          })),
        },
        STOP_FAILED: {
          guard: ({ context, event }) => event.operation === context.operation,
          actions: assign(({ context, event }) => {
            if (context.state.status !== 'ready') {
              return {};
            }

            return {
              retry: { kind: 'observe' } as const,
              state: {
                ...context.state,
                activity: {
                  status: 'failed',
                  error: event.error,
                  retry: { kind: 'stop' },
                  retryable: event.error.retryable,
                  ...(context.submission
                    ? { submission: context.submission }
                    : {}),
                },
              } satisfies SessionState,
            };
          }),
        },
        STOP: {
          target: 'working',
          reenter: true,
          guard: 'canStop',
          actions: 'stop',
        },
        RETRY: {
          target: 'working',
          reenter: true,
          guard: 'canRetry',
          actions: 'retry',
        },
      },
    },
    reconnecting: {
      after: {
        reconnect: {
          target: 'working',
          actions: assign({
            state: ({ context }) => resume(context.state, context.retry),
          }),
        },
      },
      on: {
        STOP: { target: 'working', guard: 'canStop', actions: 'stop' },
        RETRY: { target: 'working', guard: 'canRetry', actions: 'retry' },
      },
    },
    failed: {
      on: {
        RETRY: { target: 'working', guard: 'canRetry', actions: 'retry' },
        STOP: { target: 'working', guard: 'canStop', actions: 'stop' },
      },
    },
  },
});
