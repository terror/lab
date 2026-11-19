import type { RunFailureReason } from '@earendil-works/pi-durable';
import { useId, useLayoutEffect, useRef, useSyncExternalStore } from 'react';

export const runFailureTitles: Record<RunFailureReason, string> = {
  aborted: 'Stopped',
  faulted: 'Couldn’t finish this answer',
  interrupted: 'Couldn’t finish this answer because Lab restarted',
  model_error: 'Couldn’t get an answer from the model',
  no_model: 'Couldn’t answer because no model is available for this chat',
  nothing_to_answer: 'There was nothing to answer',
  orphaned: 'Couldn’t resume this answer',
  reset: 'The chat was reset before it was answered',
  restart_limit: 'Couldn’t finish this answer after several tries',
  turn_limit: 'Couldn’t finish within the tool use limit for one answer',
};

const listeners = new Set<() => void>();

let streak = 0;

let slipping: string | undefined;

function subscribe(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

function settle(failed: string | undefined) {
  slipping = failed !== undefined && streak === 0 ? failed : undefined;
  streak = failed === undefined ? 0 : streak + 1;

  for (const listener of listeners) {
    listener();
  }
}

export function useSlip(
  running: boolean,
  failure: RunFailureReason | undefined
) {
  const id = useId();
  const previous = useRef(running);

  const owner = useSyncExternalStore(subscribe, () => slipping);

  useLayoutEffect(() => {
    const ended = previous.current && !running;

    previous.current = running;

    if (ended && failure !== 'aborted') {
      settle(failure && id);
    }
  }, [failure, id, running]);

  return owner === id;
}
