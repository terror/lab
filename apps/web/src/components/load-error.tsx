import { ErrorMessage } from '@/components/error-message';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { useMoment } from '@/lib/moment';
import { RotateCw, TriangleAlert } from 'lucide-react';
import { useTransition } from 'react';

export function LoadError({
  className,
  onRetry,
  subject,
}: {
  className?: string;
  onRetry?: () => Promise<unknown>;
  subject: string;
}) {
  const [retrying, startRetry] = useTransition();
  const pose = useMoment('error.pose').on;
  const warning = <TriangleAlert aria-hidden='true' className='size-5' />;

  if (!onRetry) {
    return (
      <ErrorMessage className={className}>
        Couldn’t load {subject}.
      </ErrorMessage>
    );
  }

  return (
    <EmptyState
      action={
        <Button
          disabled={retrying}
          onClick={() =>
            startRetry(async () => {
              await onRetry();
            })
          }
          size='sm'
          variant='outline'
        >
          <RotateCw aria-hidden='true' />
          {retrying ? 'Retrying…' : 'Retry'}
        </Button>
      }
      className={className}
      description='Check your connection and try again.'
      glyph={pose ? undefined : warning}
      pose='tipped'
      role='alert'
      title={`Couldn’t load ${subject}`}
    />
  );
}
