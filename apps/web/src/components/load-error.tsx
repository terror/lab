import { ErrorMessage } from '@/components/error-message';

export function LoadError({
  className,
  subject,
}: {
  className?: string;
  subject: string;
}) {
  return (
    <ErrorMessage className={className}>Unable to load {subject}.</ErrorMessage>
  );
}
