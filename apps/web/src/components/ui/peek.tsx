import { LiveMark } from '@/components/ui/live-mark';
import { fade, spring, tween } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import * as React from 'react';

const ENTER_MS = 400;

const LEAVE_MS = 600;

function usePeeking(active: boolean) {
  const [shown, setShown] = React.useState(false);

  React.useEffect(() => {
    if (active === shown) {
      return undefined;
    }

    const timer = setTimeout(
      () => setShown(active),
      active ? ENTER_MS : LEAVE_MS
    );

    return () => clearTimeout(timer);
  }, [active, shown]);

  return shown;
}

const rising = {
  animate: {
    opacity: 1,
    transition: { opacity: fade.base, y: spring.lively },
    y: 0,
  },
  exit: {
    opacity: 0,
    transition: { opacity: fade.leave, y: tween.sink },
    y: 20,
  },
  initial: { opacity: 0, y: 20 },
};

const still = {
  animate: { opacity: 1, transition: fade.base },
  exit: { opacity: 0, transition: fade.leave },
  initial: { opacity: 0 },
};

function Peek({
  className,
  rise = true,
  shown,
  ...props
}: Omit<React.ComponentProps<'span'>, 'children'> & {
  rise?: boolean;
  shown: boolean;
}) {
  const reduced = useReducedMotion();

  const motion = rise && !reduced ? rising : still;

  return (
    <span
      aria-hidden='true'
      data-slot='peek'
      className={cn(
        'pointer-events-none absolute bottom-full flex h-5 w-4 items-end overflow-hidden',
        className
      )}
      {...props}
    >
      <AnimatePresence>
        {shown && (
          <m.span key='mark' className='flex' {...motion}>
            <LiveMark className='size-4' state='thinking' />
          </m.span>
        )}
      </AnimatePresence>
    </span>
  );
}

export { Peek, usePeeking };
