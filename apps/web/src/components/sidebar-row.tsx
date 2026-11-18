import { buttonVariants } from '@/components/ui/button';
import { ListRow } from '@/components/ui/list-row';
import { fade, spring } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { PresenceContext, m, useReducedMotion } from 'motion/react';
import { type ComponentProps, useContext } from 'react';

export const rowAction = cn(
  buttonVariants({ size: 'icon-xs', variant: 'quiet' }),
  'hover:bg-transparent aria-expanded:bg-transparent'
);

export function SidebarRow({
  className,
  selected = false,
  ...props
}: Omit<ComponentProps<typeof ListRow>, 'size'> & { selected?: boolean }) {
  return (
    <ListRow
      className={cn(
        'overflow-hidden hover:bg-sidebar-accent has-[[data-state=open]]:bg-sidebar-accent data-[state=open]:bg-sidebar-accent [&>[data-slot=list-row-content]>svg]:size-4 [&>[data-slot=list-row-content]>svg]:shrink-0 [&>[data-slot=list-row-content]>svg]:text-muted-foreground',
        selected &&
          'bg-sidebar-accent font-medium text-sidebar-accent-foreground [&>[data-slot=list-row-content]>svg]:text-sidebar-accent-foreground',
        className
      )}
      size='compact'
      {...props}
    />
  );
}

export const MotionSidebarRow = m.create(SidebarRow);

const presence = {
  animate: { height: 'auto', opacity: 1 },
  exit: { height: 0, opacity: 0 },
  initial: { height: 0, opacity: 0 },
  transition: { height: spring.snap, opacity: fade.base },
};

export function useRowPresence() {
  const reduced = useReducedMotion();
  const listed = useContext(PresenceContext) !== null;

  return listed && !reduced ? presence : {};
}
