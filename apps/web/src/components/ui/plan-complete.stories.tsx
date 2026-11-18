import NumberFlow from '@number-flow/react';
import { useId, useRef, useState } from 'react';

import preview from '../../../.storybook/preview';
import { confetti } from '../../lib/confetti';
import { cn } from '../../lib/utils';
import { Button } from './button';
import { Card } from './card';
import { Checkbox } from './checkbox';

const steps = [
  'Pick a quiet neighbourhood',
  'Day-by-day itinerary',
  'Rough budget in euros',
];

function Step({ done, text }: { done: boolean; text: string }) {
  const id = useId();

  return (
    <div className='flex min-h-7 items-center gap-2.5 text-sm'>
      <Checkbox checked={done} id={id} />
      <label htmlFor={id}>{text}</label>
    </div>
  );
}

function Plan() {
  const [done, setDone] = useState(1);

  const count = useRef<HTMLSpanElement>(null);

  const complete = done === steps.length;

  const advance = () => {
    const next = complete ? 0 : done + 1;

    setDone(next);

    if (next === steps.length && count.current) {
      void confetti(count.current);
    }
  };

  return (
    <div className='flex w-80 flex-col items-start gap-3'>
      <Card className='w-full' variant='inset'>
        <div className='flex items-center justify-between text-sm'>
          <span className='font-medium'>Plan</span>
          <span
            ref={count}
            className={cn(
              'text-muted-foreground tabular-nums transition-colors duration-slow',
              complete && 'text-spark-yellow-ink'
            )}
          >
            <NumberFlow value={done} /> of {steps.length} done
          </span>
        </div>
        {steps.map((text, index) => (
          <Step key={text} done={index < done} text={text} />
        ))}
      </Card>
      <Button onClick={advance} size='sm' variant='outline'>
        {complete ? 'Start over' : 'Finish a step'}
      </Button>
    </div>
  );
}

const meta = preview.meta({
  parameters: {
    docs: {
      description: {
        component:
          'The count rolls with @number-flow/react, and confetti from src/lib/confetti.ts marks the last step: 28 square pixels in the spark hues, once. Under reduced motion the count swaps and no confetti loads.',
      },
    },
  },
  tags: ['autodocs'],
  title: 'Patterns/Plan complete',
});

export const Default = meta.story({ render: () => <Plan /> });
