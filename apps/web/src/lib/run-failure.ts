import type { RunFailureReason } from '@earendil-works/pi-durable';

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
