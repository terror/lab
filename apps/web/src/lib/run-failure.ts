import type { RunFailureReason } from '@earendil-works/pi-durable';
import { useId, useLayoutEffect, useSyncExternalStore } from 'react';

export const runFailureTitles: Record<RunFailureReason, string> = {
  aborted: 'Stopped',
  faulted: 'Something went wrong while answering',
  interrupted: 'Lab restarted while answering',
  model_error: 'The model returned an error',
  no_model: 'No model is available for this chat',
  nothing_to_answer: 'There was nothing to answer',
  orphaned: 'Couldn’t resume this answer',
  reset: 'The chat was reset before it was answered',
  restart_limit: 'Answering kept failing, so Lab gave up',
  turn_limit: 'Lab reached its tool use limit for this answer',
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
