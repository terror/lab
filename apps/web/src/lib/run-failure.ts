import type { RunFailureReason } from '@earendil-works/pi-durable';
import { useId, useLayoutEffect, useSyncExternalStore } from 'react';

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

let first: string | undefined;

function subscribe(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

function setFirst(id: string | undefined) {
  first = id;

  for (const listener of listeners) {
    listener();
  }
}

export function useSlip(ended: boolean, failure: RunFailureReason | undefined) {
  const id = useId();

  const owner = useSyncExternalStore(subscribe, () => first);

  useLayoutEffect(() => {
    if (!ended || failure === 'aborted') {
      return;
    }

    if (failure === undefined) {
      setFirst(undefined);
    } else if (first === undefined) {
      setFirst(id);
    }
  }, [ended, failure, id]);

  return owner === id;
}
