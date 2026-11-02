import { useMachine } from '@xstate/react';

import { type SessionEvent, sessionMachine } from './session-machine';

export function useSession(sessionId: string) {
  const [snapshot, dispatch, actor] = useMachine(sessionMachine, {
    input: { sessionId },
  });

  const send = (text: string) => {
    const event = {
      type: 'SEND',
      submission: {
        sessionId,
        text: text.trim(),
        requestId: crypto.randomUUID(),
      },
    } satisfies SessionEvent;

    const current = actor.getSnapshot();

    if (current.status !== 'active' || !current.can(event)) {
      return false;
    }

    dispatch(event);

    return true;
  };

  const canSend =
    snapshot.matches('idle') &&
    snapshot.context.state.status === 'ready' &&
    snapshot.context.state.view.status !== 'running';

  return {
    state: snapshot.context.state,
    send: canSend ? send : undefined,
    stop: snapshot.can({ type: 'STOP' })
      ? () => dispatch({ type: 'STOP' })
      : undefined,
    retry: snapshot.can({ type: 'RETRY' })
      ? () => dispatch({ type: 'RETRY' })
      : undefined,
  };
}
