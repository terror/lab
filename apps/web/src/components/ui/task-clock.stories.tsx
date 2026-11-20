import { useState } from 'react';

import preview from '../../../.storybook/preview';
import { themes } from '../../../.storybook/themes';
import { Button } from './button';
import { TaskClock } from './task-clock';

const meta = preview.meta({
  component: TaskClock,
  decorators: [themes],
  tags: ['autodocs'],
  title: 'Components/Task clock',
});

export const NeverRun = meta.story({ args: {} });

export const Halfway = meta.story({ args: { progress: 0.5 } });

export const Paused = meta.story({ args: { paused: true } });

function Winding() {
  const [state, setState] = useState({ paused: true, turns: 0 });

  return (
    <div className='flex items-center gap-4'>
      <TaskClock
        paused={state.paused}
        progress={state.paused ? undefined : 0.3}
        turns={state.turns}
      />
      <Button
        onClick={() =>
          setState({
            paused: !state.paused,
            turns: state.paused ? state.turns + 1 : state.turns,
          })
        }
        size='sm'
        variant='outline'
      >
        {state.paused ? 'Resume' : 'Pause'}
      </Button>
    </div>
  );
}

export const Resume = meta.story({ render: () => <Winding /> });
