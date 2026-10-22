import { Button } from '@/components/ui/button';
import { errorPresentation, isAbortError } from '@/lib/errors';
import { AlertCircle } from 'lucide-react';

export function ErrorNotice({
  error,
  onRetry,
  retryLabel = 'Try again',
  pending = false,
}: {
  error: Error;
  onRetry?: () => void;
  retryLabel?: string;
  pending?: boolean;
}) {
  if (isAbortError(error)) {
    return null;
  }

  const { message, action } = errorPresentation(error, onRetry, retryLabel);

  return (
    <div
      role='alert'
      className='flex items-start gap-3 rounded-xl border border-destructive/15 bg-destructive/5 p-3 text-sm'
    >
      <AlertCircle
        aria-hidden='true'
        className='mt-0.5 size-4 shrink-0 text-destructive'
      />
      <div className='min-w-0 flex-1 space-y-2'>
        <p className='break-words'>{message}</p>
        {action && (
          <Button
            variant='outline'
            size='sm'
            disabled={pending}
            onClick={action.onClick}
          >
            {action.label}
          </Button>
        )}
      </div>
    </div>
  );
}
