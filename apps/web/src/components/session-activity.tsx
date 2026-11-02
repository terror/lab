import { Button } from '@/components/ui/button';
import type { SessionActivity, SessionRetry } from '@/lib/session-state';
import type { SessionView } from '@lab/app-protocol';
import { LoaderCircle } from 'lucide-react';

const presentation = {
  idle: { label: 'Ready', busy: false },
  submitting: { label: 'Sending', busy: true },
  running: { label: 'Working', busy: true },
  stopping: { label: 'Stopping', busy: true },
  reconnecting: { label: 'Reconnecting', busy: true },
  failed: { label: 'Unable to continue', busy: false },
} satisfies Record<SessionActivity['status'], { label: string; busy: boolean }>;

const retryLabels = {
  submit: 'Retry message',
  observe: 'Reconnect',
  stop: 'Retry stop',
} satisfies Record<SessionRetry['kind'], string>;

function SubmissionMessage({ text, label }: { text: string; label: string }) {
  return (
    <div className='rounded-lg bg-muted/50 p-3'>
      <p className='mb-1 text-xs text-muted-foreground'>{label}</p>

      <p className='max-h-32 overflow-y-auto text-sm break-words whitespace-pre-wrap'>
        {text}
      </p>
    </div>
  );
}

export function SessionStatus({
  activity,
  runStatus,
}: {
  activity: SessionActivity;
  runStatus: SessionView['status'];
}) {
  const { label, busy } = presentation[activity.status];

  const status =
    activity.status === 'idle' && runStatus === 'unanswered'
      ? 'Finished without a response'
      : label;

  return (
    <p
      role='status'
      className='flex items-center gap-2 text-sm text-muted-foreground'
    >
      {busy && (
        <LoaderCircle
          aria-hidden='true'
          className='size-3.5 motion-safe:animate-spin'
        />
      )}

      {status}
    </p>
  );
}

export function SessionNotice({
  activity,
  onRetry,
}: {
  activity: SessionActivity;
  onRetry?: () => void;
}) {
  switch (activity.status) {
    case 'idle':

    case 'running':

    case 'stopping':
      return null;

    case 'submitting':
      return (
        <SubmissionMessage
          text={activity.submission.text}
          label='Pending message'
        />
      );

    case 'reconnecting':

    case 'failed': {
      const submission =
        activity.submission ??
        (activity.retry.kind === 'submit'
          ? activity.retry.submission
          : undefined);

      return (
        <div className='space-y-3'>
          {submission && (
            <SubmissionMessage
              text={submission.text}
              label={
                activity.retry.kind === 'submit'
                  ? 'Pending message'
                  : 'Submitted message'
              }
            />
          )}

          <div className='flex flex-wrap items-center gap-3'>
            <p role='alert' className='text-sm text-destructive'>
              {activity.error.message}
            </p>

            {onRetry && (
              <Button variant='outline' size='sm' onClick={onRetry}>
                {retryLabels[activity.retry.kind]}
              </Button>
            )}
          </div>
        </div>
      );
    }

    default:
      return activity satisfies never;
  }
}
