import { useState } from 'react';

import preview from '../../../.storybook/preview';
import { themes } from '../../../.storybook/themes';
import { Button } from './button';
import { ProgressCount } from './progress-count';

const meta = preview.meta({
  component: ProgressCount,
  decorators: [themes],
  parameters: {
    docs: {
      description: {
        component:
          'How many steps of a plan or subagent lanes are done. The number rolls when it changes, and the count turns yellow once everything is done.',
      },
    },
  },
  tags: ['autodocs'],
  title: 'Components/Progress count',
});

function Counter() {
  const [done, setDone] = useState(2);

  return (
    <div className='flex items-center gap-4'>
      <ProgressCount done={done} total={3} />
      <Button
        onClick={() => setDone(done === 3 ? 0 : done + 1)}
        size='sm'
        variant='outline'
      >
        Finish a step
      </Button>
    </div>
  );
}

export const Default = meta.story({ render: () => <Counter /> });

export const Complete = meta.story({ args: { done: 3, total: 3 } });
