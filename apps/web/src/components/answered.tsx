import { Card } from '@/components/ui/card';
import { fade, spring } from '@/lib/motion';
import { AnimatePresence, m } from 'motion/react';
import type { ReactNode } from 'react';

export function Answered({
  answer,
  children,
  prompt,
}: {
  answer: ReactNode;
  children: ReactNode;
  prompt: string;
}) {
  return (
    <AnimatePresence initial={false}>
      {answer === undefined ? (
        <m.div
          key='asking'
          className='overflow-hidden'
          exit={{ height: 0, opacity: 0 }}
          transition={{ ...fade.fast, height: spring.glide }}
        >
          {children}
        </m.div>
      ) : (
        <m.div
          key='answered'
          animate={{ height: 'auto', opacity: 1 }}
          className='overflow-hidden'
          initial={{ height: 0, opacity: 0 }}
          transition={{ ...fade.base, height: spring.glide }}
        >
          <Card
            className='flex-row items-center gap-3 py-2.5 text-sm'
            variant='inset'
          >
            <span className='min-w-0 flex-1 truncate text-muted-foreground'>
              {prompt}
            </span>
            <span className='flex min-w-0 items-center gap-1.5 font-medium'>
              {answer}
            </span>
          </Card>
        </m.div>
      )}
    </AnimatePresence>
  );
}
