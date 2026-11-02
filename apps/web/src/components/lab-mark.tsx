import { cn } from '@/lib/utils';

export function LabMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden='true'
      className={cn('size-8 shrink-0', className)}
      fill='none'
      viewBox='0 0 32 32'
    >
      <path d='M10 2H22V6H20V14H24V18H8V14H12V6H10Z' fill='#f09082' />
      <path d='M8 18H16V26H26V30H6V26H2V22H6V18Z' fill='#4d9abf' />
      <path d='M16 18H26V22H30V26H16Z' fill='#f1be58' />
    </svg>
  );
}
